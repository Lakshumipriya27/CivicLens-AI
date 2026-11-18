"""Application configuration loaded from environment variables / .env file."""
import logging
import secrets
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
logger = logging.getLogger("civiclens.config")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    APP_NAME: str = "CivicLens AI"
    APP_ENV: str = "development"
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    DATABASE_URL: str = "sqlite:///./civiclens.db"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    AI_PROVIDER: str = "demo"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    AI_TIMEOUT_SECONDS: int = 45

    SEED_DEMO_DATA: bool = True

    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 8

    DUP_MAX_DISTANCE_M: float = 200.0
    DUP_TIME_WINDOW_DAYS: int = 30
    DUP_MIN_SCORE: float = 0.55

    PRIORITY_WEIGHT_SEVERITY: float = 0.35
    PRIORITY_WEIGHT_REPORTS: float = 0.25
    PRIORITY_WEIGHT_EXPOSURE: float = 0.20
    PRIORITY_WEIGHT_WAITING: float = 0.20
    PRIORITY_WAITING_FULL_DAYS: int = 30

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def upload_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        if not p.is_absolute():
            p = BACKEND_DIR / p
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def database_url(self) -> str:
        # Resolve relative SQLite paths against the backend folder so the DB
        # location does not depend on the current working directory.
        url = self.DATABASE_URL
        prefix = "sqlite:///./"
        if url.startswith(prefix):
            return f"sqlite:///{(BACKEND_DIR / url[len(prefix):]).as_posix()}"
        return url

    @property
    def ai_provider(self) -> str:
        return (self.AI_PROVIDER or "demo").strip().lower()

    @property
    def priority_weights(self) -> dict[str, float]:
        return {
            "severity": self.PRIORITY_WEIGHT_SEVERITY,
            "reports": self.PRIORITY_WEIGHT_REPORTS,
            "exposure": self.PRIORITY_WEIGHT_EXPOSURE,
            "waiting": self.PRIORITY_WEIGHT_WAITING,
        }


def _resolve_secret(settings: Settings) -> str:
    if settings.SECRET_KEY:
        return settings.SECRET_KEY
    secret_file = BACKEND_DIR / ".dev_secret"
    if secret_file.exists():
        return secret_file.read_text(encoding="utf-8").strip()
    value = secrets.token_urlsafe(48)
    secret_file.write_text(value, encoding="utf-8")
    logger.warning("SECRET_KEY not set; generated a local development secret in backend/.dev_secret")
    return value


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.SECRET_KEY = _resolve_secret(s)
    return s
