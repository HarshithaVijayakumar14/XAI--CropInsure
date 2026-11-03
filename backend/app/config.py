import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "XAI-CropInsure"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'data' / 'xai_cropinsure.db').as_posix()}"
    REPORTS_DIR: str = str(BASE_DIR / "reports")
    DATA_DIR: str = str(BASE_DIR / "data")
    DEMO_MODE: bool = True
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "dev-secret-key-change-in-production-only"
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")
    SARVAM_BASE_URL: str = "https://api.sarvam.ai"

settings = Settings()

os.makedirs(settings.REPORTS_DIR, exist_ok=True)
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.DATA_DIR, "templates"), exist_ok=True)
os.makedirs(os.path.join(settings.DATA_DIR, "demo"), exist_ok=True)
os.makedirs(os.path.join(settings.DATA_DIR, "models"), exist_ok=True)
