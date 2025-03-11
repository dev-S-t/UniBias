from time import time, sleep
import threading
import logging
from app.watcher.screenshot import ScreenshotTaker
from app.mule.tasks import process_screenshot

logger = logging.getLogger(__name__)

class Monitor:
    def __init__(self, interval=60, save_directory="screenshots"):
        self.interval = interval
        self.active = False
        self.paused = False  # Add a separate paused flag
        self.start_time = None
        self.user_goal = None
        self.screenshot_taker = ScreenshotTaker(interval, save_directory)
        self.monitor_thread = None
        self.latest_alert = None

    def set_user_goal(self, goal):
        """Set the user's goal for the session"""
        self.user_goal = goal

    def start(self):
        """Start monitoring"""
        if self.active and not self.paused:
            logger.info("Monitoring is already active.")
            return
            
        self.active = True
        self.paused = False
        self.start_time = time()
        logger.info("Monitoring started.")
        
        # Start monitoring in a separate thread
        self.monitor_thread = threading.Thread(target=self._monitoring_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()

    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.active:
            if not self.paused:  # Only take screenshots if not paused
                screenshot_path = self.screenshot_taker.take_screenshot()
                logger.info(f"Screenshot taken at {time() - self.start_time:.2f} seconds.")
                
                # Process the screenshot
                result = process_screenshot(screenshot_path)
                
                # Log with model-provided screenshot number
                ss_no = result.get("ss_no", "unknown")
                logger.info(f"Model analysis for screenshot #{ss_no}: {result.get('alert_level')} - {result.get('message')}")
                
                # Create an alert from the analysis result (if available)
                try:
                    from app.api.endpoints.alerts import create_alert_from_analysis
                    create_alert_from_analysis(result, screenshot_path)
                except Exception as e:
                    logger.error(f"Error creating alert: {e}")
            
            sleep(self.interval)

    def stop(self):
        """Stop monitoring"""
        if not self.active:
            logger.info("Monitoring is not active.")
            return
            
        self.active = False
        self.paused = False
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=1.0)
        logger.info("Monitoring stopped.")

    def pause(self):
        """Pause monitoring"""
        if not self.active or self.paused:
            logger.info("Monitoring is already paused or not active.")
            return
            
        self.paused = True
        logger.info("Monitoring paused.")

    def resume(self):
        """Resume monitoring"""
        if not self.active:
            # If monitoring was stopped, we need to start from scratch
            logger.info("Monitoring was not active, starting fresh.")
            self.start()
            return
            
        if not self.paused:
            logger.info("Monitoring is already active.")
            return
            
        # Just unpause, don't create a new thread
        self.paused = False
        logger.info("Monitoring resumed.")
        
    @property
    def is_running(self):
        """Check if monitoring is running"""
        return self.active and not self.paused
        
    def set_interval(self, interval):
        """Set the screenshot interval"""
        if interval <= 0:
            raise ValueError("Interval must be greater than zero")
        self.interval = interval
        self.screenshot_taker.interval = interval

# Example usage
if __name__ == "__main__":
    monitor = Monitor(interval=10)
    monitor.start()  # Start monitoring
    sleep(30)        # Let it run for a while
    monitor.pause()  # Pause monitoring
    sleep(10)        # Wait before resuming
    monitor.resume() # Resume monitoring
    sleep(30)        # Let it run for a while
    monitor.stop()   # Stop monitoring