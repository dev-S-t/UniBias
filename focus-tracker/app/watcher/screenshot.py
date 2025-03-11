from datetime import datetime
import time
import pyautogui
import os
import glob

class ScreenshotTaker:
    def __init__(self, interval: int, save_directory: str, max_screenshots=5):
        self.interval = interval
        self.save_directory = save_directory
        self.max_screenshots = max_screenshots
        self.running = False
        os.makedirs(self.save_directory, exist_ok=True)

    def take_screenshot(self):
        """Take a screenshot and save it to the specified directory"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = os.path.join(self.save_directory, f"screenshot_{timestamp}.png")
        screenshot = pyautogui.screenshot()
        screenshot.save(screenshot_path)
        
        # Keep only the most recent screenshots
        self._cleanup_old_screenshots()
        
        return screenshot_path

    def _cleanup_old_screenshots(self):
        """Delete older screenshots, keeping only the most recent ones"""
        screenshots = glob.glob(os.path.join(self.save_directory, "screenshot_*.png"))
        screenshots.sort(key=os.path.getctime)  # Sort by creation time
        
        # Remove older screenshots if we have more than the maximum
        while len(screenshots) > self.max_screenshots:
            oldest = screenshots.pop(0)  # Get the oldest screenshot
            try:
                os.remove(oldest)
                print(f"Removed old screenshot: {oldest}")
            except Exception as e:
                print(f"Error removing screenshot: {e}")

    def start(self):
        """Start taking screenshots at the specified interval"""
        self.running = True
        while self.running:
            screenshot_path = self.take_screenshot()
            print(f"Screenshot taken: {screenshot_path}")
            time.sleep(self.interval)
            
    def stop(self):
        """Stop taking screenshots"""
        self.running = False

if __name__ == "__main__":
    interval = 10  # seconds
    save_directory = "screenshots"
    screenshot_taker = ScreenshotTaker(interval, save_directory)
    screenshot_taker.start()