from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import time
from app.mule.tasks import set_user_goal, process_screenshot, get_session_summary as generate_session_summary
from app.watcher.monitor import Monitor
import logging
from app.utils.image_analysis import set_api_key, reset_api_key

# Constants
ALERT_LEVEL_NORMAL = "NORMAL"
ALERT_LEVEL_CAUTION = "CAUTION"
ALERT_LEVEL_ALERT = "ALERT"

router = APIRouter(prefix="/api", tags=["alerts"])

# Initialize the monitor
monitor = Monitor(interval=10, save_directory="screenshots")

class Goal(BaseModel):
    text: str
    session_duration: int  # in minutes
    screenshot_interval: int  # in seconds
    api_key: Optional[str] = None  # User's optional API key

class Alert(BaseModel):
    message: str
    timestamp: str
    alert_level: str
    confidence: Optional[float] = None
    screenshot_path: Optional[str] = None

class SessionStatus(BaseModel):
    is_active: bool
    start_time: Optional[str] = None
    elapsed_time: Optional[float] = None
    goal: Optional[str] = None
    latest_alert: Optional[Alert] = None

alerts_db = []

logger = logging.getLogger(__name__)

class SessionData:
    def __init__(self):
        self.start_time = None
        self.goal = None
        self.screenshots = []
        self.alerts = []
        self.end_time = None
        
    def reset(self):
        self.__init__()
        
session_data = SessionData()

# Fix the create_goal endpoint to validate API keys
@router.post("/goals/", response_model=Goal, status_code=201)
async def create_goal(goal: Goal, background_tasks: BackgroundTasks):
    """Set a new goal and start the monitoring session"""
    logger.info(f"Creating new goal: {goal.text}")
    
    try:
        # Check if a custom API key was provided
        if hasattr(goal, 'api_key') and goal.api_key:
            logger.info("User provided a custom API key, validating...")
            
            # Try to configure with the custom key
            key_valid = set_api_key(goal.api_key)
            
            if not key_valid:
                # Key validation failed
                logger.warning("Custom API key validation failed, falling back to default")
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid API key. Please check your key and try again."
                )
            
            logger.info("Custom API key validated successfully")
        
        # Set the user's goal
        set_user_goal(goal.text)
        
        # Store session data
        session_data.start_time = datetime.now()
        session_data.goal = goal.text
        session_data.screenshots = []
        session_data.alerts = []
        
        # Configure and start the monitor
        monitor.set_interval(goal.screenshot_interval)
        monitor.start()
        logger.info(f"Started monitoring with interval: {goal.screenshot_interval}s")
        
        # Create a response without the API key
        return Goal(
            text=goal.text,
            session_duration=goal.session_duration,
            screenshot_interval=goal.screenshot_interval
        )
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions
        raise http_ex
    except Exception as e:
        logger.error(f"Error creating goal: {str(e)}")
        reset_api_key()  # Ensure we reset to default key on errors
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")

# Add an endpoint to check API key status
@router.post("/settings/validate-key")  # changed from /validate_api_key
async def validate_key(data: dict):
    """Validate a user's API key without starting a session"""
    if "api_key" not in data or not data["api_key"]:
        return {"valid": False, "message": "No API key provided"}
        
    try:
        key_valid = set_api_key(data["api_key"])
        
        if key_valid:
            reset_api_key()
            return {"valid": True, "message": "API key is valid"}
        else:
            return {"valid": False, "message": "Invalid API key"}
    except Exception as e:
        reset_api_key()
        return {"valid": False, "message": f"Error validating API key: {str(e)}"}

# Add a function to create alerts from analysis results
def create_alert_from_analysis(result, screenshot_path):
    """Create an alert from screenshot analysis results"""
    if result.get("status") != "success":
        logger.warning(f"Not creating alert for unsuccessful analysis: {result.get('message')}")
        return None
        
    # Create a timestamp
    now = datetime.now().isoformat()
    
    # Extract data from the analysis result
    alert = Alert(
        message=result.get("message", "No message provided"),
        timestamp=now,
        alert_level=result.get("alert_level", "UNKNOWN"),
        confidence=result.get("confidence"),
        screenshot_path=screenshot_path
    )
    
    # Add to the alerts database
    alerts_db.append(alert)
    
    # Update session data
    session_data.screenshots.append(result)
    if result.get("alert_level") in [ALERT_LEVEL_CAUTION, ALERT_LEVEL_ALERT]:
        session_data.alerts.append(result)
    
    logger.info(f"Created {alert.alert_level} alert: {alert.message}")
    return alert

# Also add the missing get_latest_alert function that's referenced elsewhere
def get_latest_alert():
    """Get the most recent alert"""
    if not alerts_db:
        return None
    return alerts_db[-1]

@router.post("/alerts/", response_model=Alert)
async def create_alert(alert: Alert):
    """Create a new alert"""
    alerts_db.append(alert)
    return alert

@router.get("/alerts/", response_model=List[Alert])
async def get_alerts():
    """Get all alerts"""
    return alerts_db

@router.delete("/alerts/{alert_id}", response_model=Alert)
async def delete_alert(alert_id: int):
    """Delete an alert by ID"""
    if alert_id < 0 or alert_id >= len(alerts_db):
        raise HTTPException(status_code=404, detail="Alert not found")
    return alerts_db.pop(alert_id)

@router.get("/session/status", response_model=SessionStatus)
async def get_session_status():
    """Get the current session status"""
    if not monitor.is_running:
        return SessionStatus(is_active=False)
        
    elapsed = 0
    if monitor.start_time:
        elapsed = time.time() - monitor.start_time
        
    return SessionStatus(
        is_active=True,
        start_time=datetime.fromtimestamp(monitor.start_time).isoformat() if monitor.start_time else None,
        elapsed_time=elapsed,
        goal=monitor.goal if hasattr(monitor, "goal") else None,
        latest_alert=get_latest_alert()
    )

@router.post("/session/start")
async def start_session():
    """Start the monitoring session"""
    monitor.start()
    return {"message": "Session started", "status": "success"}

# Add or update session control endpoints
@router.post("/session/pause")
async def pause_session():
    """Pause the monitoring session"""
    logger.info("Pause session request received")
    monitor.pause()
    return {"message": "Session paused", "status": "success"}

@router.post("/session/resume")
async def resume_session():
    """Resume the monitoring session"""
    logger.info("Resume session request received")
    monitor.resume()
    return {"message": "Session resumed", "status": "success"}

# Update the stop_session endpoint to reset the API key
@router.post("/session/stop")
async def stop_session():
    """Stop the monitoring session"""
    logger.info("Stop session request received")
    # Stop monitoring but keep session data for summary
    monitor.stop()
    
    # Reset to default API key
    reset_api_key()
    
    return {"message": "Session stopped", "status": "success"}

# Fix the get_session_summary endpoint
@router.get("/session/summary")
async def get_session_summary_endpoint():
    """Generate a summary of the completed session"""
    logger.info("Session summary requested")
    
    if not session_data.start_time:
        logger.warning("No session data available for summary")
        # Return a default summary instead of error
        return {
            "goal": "No recent session data found",
            "duration": 0,
            "screenshot_count": 0,
            "distraction_count": 0,
            "focus_percentage": 0,
            "summary": "No session data available to summarize.",
            "tips": ["Start a new focus session to track your productivity."]
        }
    
    # Calculate session stats
    end_time = datetime.now()
    duration = (end_time - session_data.start_time).total_seconds()
    
    screenshot_count = len(session_data.screenshots)
    distraction_count = sum(1 for s in session_data.screenshots if s["alert_level"] in [ALERT_LEVEL_CAUTION, ALERT_LEVEL_ALERT])
    
    if screenshot_count > 0:
        focus_percentage = ((screenshot_count - distraction_count) / screenshot_count) * 100
    else:
        focus_percentage = 100  # Default if no screenshots
    
    # Generate a summary text
    summary_text, tips = generate_session_summary(
        session_data.goal, 
        duration, 
        screenshot_count, 
        distraction_count, 
        focus_percentage
    )
    
    logger.info(f"Generated session summary: {summary_text[:50]}...")
    
    return {
        "goal": session_data.goal or "No goal specified",
        "duration": duration,
        "screenshot_count": screenshot_count,
        "distraction_count": distraction_count,
        "focus_percentage": focus_percentage,
        "summary": summary_text,
        "tips": tips
    }