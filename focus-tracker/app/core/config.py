from pydantic import BaseSettings

class Settings(BaseSettings):
    api_key: str
    screenshot_interval: int = 10  # default to 10 seconds
    alert_threshold: int = 5  # default threshold for alerts

    class Config:
        env_file = ".env"

settings = Settings()