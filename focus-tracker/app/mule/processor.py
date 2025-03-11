from typing import List, Dict
import os
from app.utils.image_analysis import GeminiAnalyzer
from app.core.settings import settings

class Processor:
    def __init__(self):
        self.analyzer = GeminiAnalyzer()
        self.user_goal = None
        self.consecutive_alerts = 0
        
    def set_user_goal(self, goal: str):
        """Set the user's goal for the session"""
        self.user_goal = goal
        
    def process_screenshot(self, screenshot_path: str) -> Dict:
        """Process a single screenshot"""
        if not os.path.exists(screenshot_path):
            return {"status": "error", "alert_level": "ERROR", "message": f"Screenshot not found: {screenshot_path}"}
            
        # Analyze the screenshot
        result = self.analyzer.analyze_image(screenshot_path, self.user_goal)
        
        # Track consecutive alerts
        if result.get("alert_level") == "ALERT":
            self.consecutive_alerts += 1
        else:
            self.consecutive_alerts = 0
            
        # Add additional context to the result
        result["consecutive_alerts"] = self.consecutive_alerts
        result["screenshot_path"] = screenshot_path
        
        return result
        
    def process_screenshots(self, screenshots: List[str]) -> List[Dict]:
        """Process multiple screenshots"""
        results = []
        for screenshot in screenshots:
            result = self.process_screenshot(screenshot)
            results.append(result)
        return results