import logging
import os
import google.generativeai as genai
from fastapi import BackgroundTasks
from typing import List, Dict
from app.mule.processor import Processor
from app.core.settings import settings

logger = logging.getLogger(__name__)

# Configure the API
genai.configure(api_key=os.environ.get("API_KEY", settings.api_key))

processor = Processor()

def process_screenshots(screenshot_paths: List[str], background_tasks: BackgroundTasks):
    """Process multiple screenshots in the background"""
    for path in screenshot_paths:
        background_tasks.add_task(process_screenshot, path)

def process_screenshot(path: str):
    """Process a single screenshot"""
    return processor.process_screenshot(path)

def analyze_screenshots(screenshot_paths: List[str]):
    """Analyze multiple screenshots and return the results"""
    results = []
    for path in screenshot_paths:
        result = processor.process_screenshot(path)
        results.append(result)
    return results

def set_user_goal(goal: str):
    """Set the user's goal for the session"""
    processor.set_user_goal(goal)

def get_session_summary(goal, duration_seconds, screenshot_count, distraction_count, focus_percentage):
    """Generate a session summary using the Gemini model"""
    # Format duration in a readable way
    minutes, seconds = divmod(int(duration_seconds), 60)
    hours, minutes = divmod(minutes, 60)
    
    duration_str = ""
    if hours > 0:
        duration_str += f"{hours} hour{'s' if hours > 1 else ''} "
    if minutes > 0:
        duration_str += f"{minutes} minute{'s' if minutes > 1 else ''} "
    if seconds > 0 and hours == 0:  # Only show seconds if less than an hour
        duration_str += f"{seconds} second{'s' if seconds > 1 else ''}"
    
    duration_str = duration_str.strip() or "0 seconds"
    
    try:
        # Create Gemini model
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Create the prompt for the session summary
        prompt = f"""
        As a focus and productivity assistant, create a summary of the user's focus session:
        
        Session Details:
        - Goal: "{goal}"
        - Duration: {duration_str}
        - Screenshots taken: {screenshot_count}
        - Distractions detected: {distraction_count}
        - Focus percentage: {focus_percentage:.1f}%
        
        Please provide:
        1. A personalized summary paragraph evaluating their session (3-4 sentences)
        2. 3-4 actionable tips to improve focus next time
        
        Format your response as a JSON object with these fields:
        - "summary": The summary paragraph
        - "tips": An array of string tips
        
        Be encouraging but honest about their performance.
        """
        
        logger.info(f"Requesting session summary from Gemini for goal: {goal}")
        
        # Generate the response
        response = model.generate_content(prompt)
        
        # Try to parse the response as JSON
        import json
        import re
        
        # Extract JSON from the response
        response_text = response.text
        logger.info(f"Received summary response: {response_text[:100]}...")
        
        # Look for JSON pattern
        json_match = re.search(r'({.*})', response_text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
                summary = data.get("summary", "")
                tips = data.get("tips", [])
                
                logger.info(f"Successfully parsed summary: {summary[:50]}...")
                return summary, tips
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from model response")
        
        # If we can't parse JSON, try to extract summary and tips manually
        lines = response_text.split('\n')
        summary_lines = []
        tips = []
        
        in_summary = False
        in_tips = False
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if "summary" in line.lower() or "evaluation" in line.lower():
                in_summary = True
                in_tips = False
                continue
                
            if "tips" in line.lower() or "suggestions" in line.lower() or "recommendations" in line.lower():
                in_summary = False
                in_tips = True
                continue
                
            if in_summary:
                summary_lines.append(line)
                
            if in_tips and (line.startswith("-") or line.startswith("*") or line.startswith("•") or 
                            line[0].isdigit() and line[1] in [".", ")"]):
                tips.append(line.lstrip("- *•0123456789.) "))
        
        summary = " ".join(summary_lines)
        
        # If we still don't have summary or tips, use fallback
        if not summary or not tips:
            return fallback_summary(goal, duration_str, focus_percentage)
            
        return summary, tips
            
    except Exception as e:
        logger.error(f"Error generating session summary: {str(e)}")
        return fallback_summary(goal, duration_str, focus_percentage)

def fallback_summary(goal, duration_str, focus_percentage):
    """Fallback summary generator if the model fails"""
    if focus_percentage >= 90:
        summary = f"Excellent session! You maintained strong focus on your goal '{goal}' for {duration_str}."
        tips = [
            "Keep up the great work!",
            "Consider extending your session duration next time.",
            "Try challenging yourself with more complex tasks."
        ]
    elif focus_percentage >= 70:
        summary = f"Good session. You were focused on '{goal}' most of the time ({focus_percentage:.1f}%) for {duration_str}."
        tips = [
            "Try to identify what caused your distractions.",
            "Consider using the Pomodoro technique (25 minutes work, 5 minutes break).",
            "Create a more distraction-free environment next time."
        ]
    else:
        summary = f"You worked on '{goal}' for {duration_str}, but faced several distractions (focused {focus_percentage:.1f}% of the time)."
        tips = [
            "Try to eliminate common distractions before your next session.",
            "Consider shorter focus sessions with more frequent breaks.",
            "Set clearer, smaller goals for each session.",
            "Try using website blockers or focus mode on your devices."
        ]
    
    return summary, tips