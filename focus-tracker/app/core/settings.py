# Update the import to use pydantic_settings instead of pydantic
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application settings"""
    app_name: str = "Focus Tracker"
    api_key: str = "YOUR_DEFAULT_API_KEY"  # Default API key for Gemini Vision API
    max_screenshots: int = 5  # Maximum number of screenshots to keep
    screenshot_dir: str = "screenshots"
    
    # Add the fields from .env that are causing the validation errors
    goal: str = "Focus"
    screenshot_interval: int = 5
    alert_threshold: int = 3
    debug: bool = False

    # Update Config to use SettingsConfigDict and allow extra fields
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"  # This will ignore extra fields in the environment
    )

# Create a global settings instance
settings = Settings()

def get_settings():
    """Return the settings instance"""
    return settings