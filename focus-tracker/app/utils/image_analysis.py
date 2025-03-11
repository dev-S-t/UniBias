# app/utils/image_analysis.py
import os
import base64
import json
import logging
from collections import deque
import google.generativeai as genai
from app.core.settings import settings

logger = logging.getLogger(__name__)

# Store the default API key and track custom key status
_default_api_key = os.environ.get("API_KEY", settings.api_key)
_using_custom_key = False
_custom_key_valid = False

def set_api_key(api_key):
    """Set a custom API key for the Gemini model with validation"""
    global _using_custom_key, _custom_key_valid
    
    if not api_key or not api_key.strip():
        logger.warning("Attempted to set empty API key, using default")
        reset_api_key()
        return False
        
    logger.info("Setting custom API key for Gemini")
    
    try:
        # Try to validate the key with a simple call first
        genai.configure(api_key=api_key)
        
        # Do a simple test call to verify the key works
        test_model = genai.GenerativeModel("gemini-1.5-flash")
        test_response = test_model.generate_content("Test validation. Respond with 'OK'.")
        
        if test_response and hasattr(test_response, 'text'):
            logger.info("Custom API key validation successful")
            _using_custom_key = True
            _custom_key_valid = True
            return True
        else:
            logger.warning("Custom API key didn't return expected response")
            reset_api_key()
            return False
            
    except Exception as e:
        logger.error(f"Invalid custom API key: {str(e)}")
        reset_api_key()
        return False

def reset_api_key():
    """Reset to the default API key"""
    global _using_custom_key, _custom_key_valid
    logger.info("Resetting to default API key")
    genai.configure(api_key=_default_api_key)
    _using_custom_key = False
    _custom_key_valid = False

def is_using_custom_key():
    """Check if a custom key is currently being used"""
    return _using_custom_key and _custom_key_valid

def get_api_key_status():
    """Get current API key status information"""
    return {
        "using_custom_key": _using_custom_key,
        "custom_key_valid": _custom_key_valid
    }

class AlertTracker:
    """Track consecutive alert statuses to determine when to escalate alerts"""
    
    def __init__(self, window_size=3):
        self.statuses = deque(maxlen=window_size)
        self.window_size = window_size
        
    def add_status(self, status):
        """Add a new status and evaluate if it's a persistent alert"""
        self.statuses.append(status)
        
    def is_persistent_alert(self):
        """Check if all recent statuses are alerts"""
        return (len(self.statuses) == self.window_size and 
                all(s == "ALERT" for s in self.statuses))
                
    def is_emerging_alert(self):
        """Check if there's at least one alert but not persistent yet"""
        return "ALERT" in self.statuses and not self.is_persistent_alert()
        
    def reset(self):
        """Clear all tracked statuses"""
        self.statuses.clear()
        
    def get_status_history(self):
        """Return the current status history as a list"""
        return list(self.statuses)

class GeminiAnalyzer:
    def __init__(self):
        # Configure the API
        genai.configure(api_key=os.environ.get("API_KEY", settings.api_key))
        # Update to use the currently supported model
        self.model_name = "gemini-1.5-flash"  # Updated from deprecated gemini-pro-vision
        self.model = genai.GenerativeModel(self.model_name)
        self.chat_history = []
        # Track the last few analysis results (status only)
        self.recent_statuses = deque(maxlen=3)
        # Internal counter for logging only - model will track its own counter
        self._screenshot_counter = 0
        # Initialize the alert tracker
        self.alert_tracker = AlertTracker()

    def analyze_image(self, image_path, user_goal=None):
        """Analyze a screenshot using Google's Gemini API"""
        try:
            # Update internal counter for logging
            self._screenshot_counter += 1
            
            # Load image bytes
            with open(image_path, "rb") as img_file:
                image_bytes = img_file.read()

            user_text = f"Goal: {user_goal}" if user_goal else "Please analyze this screenshot."
            
            # Create the model with safety settings
            generation_config = {
                "temperature": 0.2,
                "top_p": 0.95,
                "top_k": 64,
                "max_output_tokens": 512,
            }
            
            # Start a chat session
            chat = self.model.start_chat(history=self.chat_history)
            
            # Prepare the prompt with system instructions requesting JSON output
            prompt = f"""
            Analyze this screenshot in relation to the user's stated goal.
            Determine if what's shown in the screenshot aligns with the user's stated goal and porgress is being made towards it.
            
            Keep track of which screenshot number this is in the current session - this is an important part of your task.
            If this is the first screenshot, mark it as 1, then increment the count for each subsequent screenshot.
            
            RESPOND ONLY WITH A JSON OBJECT containing these properties:
            1. "status": (string) MUST be exactly one of "POSITIVE", "CAUTION", or "POTENTIAL_DISTRACTION"
               - POSITIVE: if the screen content directly supports the user's aim
               - CAUTION: if the screen content is somewhat related but might lead to distraction
               - POTENTIAL_DISTRACTION: if the screen content is clearly unrelated to the user's goal
            2. "confidence": (number) A percentage between 0-100 indicating confidence in your assessment
            3. "explanation": (string) A brief explanation of why you gave this status
            4. "ss_no": (number) The current screenshot number in the session sequence (start at 1 for first screenshot)
            
            User's current goal: {user_goal if user_goal else "No specific goal provided"}
            
            Important: users might need brief moments to switch between relevant applications. Alert when the user is distracted in the last screenshot also 
            try to understand users intention and goal and mark the distraction accordingly. Be strict in marking the distraction. give alerts quickly , so the user can stay away from distractions.
            
            Note: if you see a timer screen in the screenshot ignore that tab completely, it is just the application in which you are running and focus on the other contents of the screen in the provided screenshot.

            Your response MUST be valid JSON format.
            """

            # Send the image with the prompt
            logger.info(f"Sending screenshot (internal #: {self._screenshot_counter}) for analysis")
            response = chat.send_message(
                [prompt, {"mime_type": "image/jpeg", "data": base64.b64encode(image_bytes).decode("utf-8")}],
                generation_config=generation_config
            )

            # Print first 100 chars of response for debugging
            response_preview = response.text[:100] + "..." if len(response.text) > 100 else response.text
            logger.info(f"Received response from model: {response_preview}")
            
            # Update chat history
            self.chat_history = chat.history
            
            # Parse the JSON response
            raw_result = self.parse_json_response(response.text)
            
            # Process the raw result to take into account consecutive distractions
            processed_result = self.process_result_history(raw_result)
            
            # Log the model's screenshot number vs our internal counter
            model_ss_no = processed_result.get("ss_no", "not provided")
            logger.info(f"Model reports screenshot #{model_ss_no}, internal count is #{self._screenshot_counter}")
            
            return processed_result
            
        except Exception as e:
            logger.error(f"Error analyzing image (internal #: {self._screenshot_counter}): {str(e)}")
            self.recent_statuses.clear()  # Reset on errors
            return {"status": "error", "alert_level": "ERROR", "message": str(e), "confidence": 0}

    def process_result_history(self, result):
        """Process results taking into account consecutive screenshots"""
        # Store the raw status from this analysis
        status = result.get("alert_level")
        self.alert_tracker.add_status(status)
        
        # Make a copy of the result to modify
        processed_result = dict(result)
        
        # Check for three consecutive ALERT statuses
        if self.alert_tracker.is_persistent_alert():
            processed_result["alert_level"] = "ALERT"
            processed_result["message"] = "Persistent distraction detected across multiple screenshots: " + processed_result["message"]
            logger.warning("Three consecutive distractions detected - raising ALERT")
        # If we have potential distraction but not 3 consecutive ones yet, downgrade to CAUTION
        elif self.alert_tracker.is_emerging_alert():
            processed_result["alert_level"] = "CAUTION"
            processed_result["message"] = "Potential distraction detected - continuing to monitor: " + processed_result["message"]
            
        # Log the history for debugging
        logger.info(f"Recent status history: {self.alert_tracker.get_status_history()}, Current alert: {processed_result['alert_level']}")
        
        return processed_result

    def parse_json_response(self, response_text):
        """Parse the JSON response from the model"""
        try:
            # Clean the response in case there's text before or after the JSON
            # First try to find JSON between curly braces
            start = response_text.find('{')
            end = response_text.rfind('}')
            
            if start >= 0 and end >= 0:
                json_text = response_text[start:end+1]
                logger.info(f"Extracted JSON: {json_text[:100]}...")
                data = json.loads(json_text)
            else:
                # Fallback to the original interpretation method
                logger.warning("No JSON object found in response, falling back to text interpretation")
                return self.interpret_results(response_text)

            # Map the parsed JSON to our expected output format
            status = data.get("status", "UNKNOWN").upper()
            confidence = data.get("confidence", 0)
            explanation = data.get("explanation", "No explanation provided")
            ss_no = data.get("ss_no", self._screenshot_counter)  # Use model's number or fallback to internal
            
            # Map status to alert_level
            alert_level = "NORMAL"
            if status == "CAUTION":
                alert_level = "CAUTION"
            elif status == "POTENTIAL_DISTRACTION":
                alert_level = "ALERT"  # We'll downgrade this if it's not consistent
            
            logger.info(f"Parsed result for model's screenshot #{ss_no}: status={status}, confidence={confidence}")
            
            return {
                "status": "success",
                "alert_level": alert_level,
                "message": explanation,
                "confidence": confidence,
                "ss_no": ss_no
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {str(e)}")
            # Fallback to the original interpretation method
            return self.interpret_results(response_text)

    def interpret_results(self, response_text):
        """Interpret the API response when JSON parsing fails"""
        response_text = response_text.strip().upper()
        
        if "POSITIVE" in response_text:
            return {
                "status": "success", 
                "alert_level": "NORMAL", 
                "message": "On track", 
                "confidence": 50,
                "ss_no": self._screenshot_counter  # Use internal counter as fallback
            }
        elif "CAUTION" in response_text:
            return {
                "status": "success", 
                "alert_level": "CAUTION", 
                "message": "Potential distraction detected", 
                "confidence": 50,
                "ss_no": self._screenshot_counter
            }
        elif "POTENTIAL_DISTRACTION" in response_text or "DISTRACTION" in response_text:
            return {
                "status": "success", 
                "alert_level": "ALERT", 
                "message": "Distraction detected", 
                "confidence": 50,
                "ss_no": self._screenshot_counter
            }
        else:
            return {
                "status": "success", 
                "alert_level": "UNKNOWN", 
                "message": "Unable to determine focus level", 
                "confidence": 0,
                "ss_no": self._screenshot_counter
            }

    def reset_history(self):
        """Reset the status history and internal counter when starting a new session"""
        self.recent_statuses.clear()
        self._screenshot_counter = 0
        self.chat_history = []  # Important: Also reset the chat history to start fresh
        reset_api_key()  # Reset to the default API key
        logger.info("Reset analyzer history, screenshot counter, and API key")