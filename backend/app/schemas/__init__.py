"""Pydantic request/response schemas."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.utils.constants import CATEGORIES, SEVERITIES, STATUSES


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------- Auth ----------------
class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("full_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Name is too short")
        return v

    @field_validator("password")
    @classmethod
    def _strength(cls, v: str) -> str:
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one letter and one number")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password is too long")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(ORM):
    id: int
    full_name: str
    email: str
    role: str
    is_demo: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdateIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def _strength(cls, v: str) -> str:
        return RegisterIn._strength(v)


# ---------------- AI ----------------
class AnalysisOut(ORM):
    id: int
    report_id: int | None
    is_civic_issue: bool
    detected_category: str
    visible_observation: str
    suggested_severity: str
    confidence_score: float | None
    confidence_note: str | None
    suggested_description: str
    safety_concern: str | None
    provider: str
    model_name: str | None
    is_simulated: bool
    created_at: datetime


# ---------------- Reports ----------------
class ReportUpdateIn(BaseModel):
    category: str | None = None
    description: str | None = Field(default=None, min_length=5, max_length=2000)
    address: str | None = Field(default=None, max_length=255)
    severity: str | None = None
    status: str | None = None
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("category")
    @classmethod
    def _cat(cls, v):
        if v is not None and v not in CATEGORIES:
            raise ValueError("Unknown category")
        return v

    @field_validator("severity")
    @classmethod
    def _sev(cls, v):
        if v is not None and v not in SEVERITIES:
            raise ValueError("Unknown severity")
        return v

    @field_validator("status")
    @classmethod
    def _st(cls, v):
        if v is not None and v not in STATUSES:
            raise ValueError("Unknown status")
        return v


# ---------------- Duplicates ----------------
class DuplicateCheckIn(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    category: str
    description: str = Field(default="", max_length=2000)
    analysis_id: int | None = None


class DuplicateReviewIn(BaseModel):
    decision: Literal["confirm", "reject"]
    note: str | None = Field(default=None, max_length=1000)


# ---------------- Incidents ----------------
class IncidentCreateIn(BaseModel):
    report_ids: list[int] = Field(min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = None
    note: str | None = Field(default=None, max_length=1000)


class GroupIn(BaseModel):
    report_ids: list[int] = Field(min_length=1, max_length=50)
    note: str | None = Field(default=None, max_length=1000)


class IncidentUpdateIn(BaseModel):
    description: str | None = Field(default=None, min_length=5, max_length=2000)
    category: str | None = None
    address: str | None = Field(default=None, max_length=255)
    exposure_override: float | None = Field(default=None, ge=0, le=100)
    clear_exposure_override: bool = False


class NoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


# ---------------- Priority ----------------
class PriorityIn(BaseModel):
    severity: float = Field(ge=0, le=100)
    reports: float = Field(ge=0, le=100)
    exposure: float = Field(ge=0, le=100)
    waiting: float = Field(ge=0, le=100)
    weights: dict[str, float] | None = None

    @field_validator("weights")
    @classmethod
    def _w(cls, v):
        if v is None:
            return v
        keys = {"severity", "reports", "exposure", "waiting"}
        if set(v) != keys or any(x < 0 for x in v.values()) or sum(v.values()) <= 0:
            raise ValueError("weights must contain non-negative severity, reports, exposure, waiting")
        return v
