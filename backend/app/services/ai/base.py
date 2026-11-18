"""Provider-independent AI analysis contract."""
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.utils.constants import CATEGORIES, SEVERITIES


class AIServiceError(Exception):
    """Raised when the configured AI provider cannot produce a valid analysis."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class AnalysisResult(BaseModel):
    """Validated, normalised analysis output stored in the database."""
    is_civic_issue: bool = True
    detected_category: str
    visible_observation: str = Field(min_length=3, max_length=1200)
    possible_severity: Literal["low", "medium", "high", "critical"]
    confidence_score: float | None = Field(default=None, ge=0, le=1)
    confidence_note: str | None = None
    suggested_description: str = Field(min_length=3, max_length=1200)
    safety_concern: str | None = Field(default=None, max_length=600)
    analysis_provider: str
    model_name: str | None = None
    is_simulated: bool = False
    analysis_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    raw_response: str | None = None

    @field_validator("detected_category")
    @classmethod
    def _valid_category(cls, v: str) -> str:
        v = (v or "").strip().lower()
        return v if v in CATEGORIES else "other"

    @field_validator("possible_severity", mode="before")
    @classmethod
    def _valid_severity(cls, v):
        v = str(v or "").strip().lower()
        return v if v in SEVERITIES else "medium"


class VisionProvider(ABC):
    name: str = "base"

    @abstractmethod
    def analyze(self, image_jpeg: bytes, user_hint: str | None = None) -> AnalysisResult:
        ...
