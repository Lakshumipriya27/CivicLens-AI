"""SQLAlchemy ORM models for CivicLens AI."""
from datetime import datetime, timezone

from sqlalchemy import (Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer,
                        String, Text, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="citizen")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    reports: Mapped[list["Report"]] = relationship(back_populates="user")

    __table_args__ = (CheckConstraint("role IN ('citizen','admin')", name="ck_users_role"),)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str | None] = mapped_column(String(255))
    severity: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    exposure_override: Mapped[float | None] = mapped_column(Float)
    priority_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    priority_level: Mapped[str] = mapped_column(String(20), default="low", index=True, nullable=False)
    priority_breakdown: Mapped[str | None] = mapped_column(Text)  # JSON
    status: Mapped[str] = mapped_column(String(20), default="under_review", index=True, nullable=False)
    supporting_report_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    resolution_note: Mapped[str | None] = mapped_column(Text)
    resolution_image_path: Mapped[str | None] = mapped_column(String(255))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    reports: Mapped[list["Report"]] = relationship(back_populates="incident")
    notes: Mapped[list["AdminNote"]] = relationship(back_populates="incident", cascade="all, delete-orphan",
                                                    order_by="AdminNote.created_at.desc()")

    __table_args__ = (
        CheckConstraint("priority_score >= 0 AND priority_score <= 100", name="ck_incident_priority_range"),
    )


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(255))
    image_hash: Mapped[str | None] = mapped_column(String(32))
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str | None] = mapped_column(String(255))
    severity: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="submitted", index=True, nullable=False)
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id", ondelete="SET NULL"), index=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user: Mapped[User] = relationship(back_populates="reports")
    incident: Mapped[Incident | None] = relationship(back_populates="reports")
    analysis: Mapped["AIAnalysis | None"] = relationship(back_populates="report", uselist=False)

    __table_args__ = (
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_report_lat"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_report_lng"),
        Index("ix_reports_lat_lng", "latitude", "longitude"),
    )


class AIAnalysis(Base):
    """Result of AI (or clearly-labelled simulated) image analysis.

    Created when a citizen uploads a photo, before the report exists; linked to the report on submission.
    """
    __tablename__ = "ai_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int | None] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    image_path: Mapped[str] = mapped_column(String(255), nullable=False)
    image_hash: Mapped[str | None] = mapped_column(String(32))
    is_civic_issue: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    detected_category: Mapped[str] = mapped_column(String(40), nullable=False)
    visible_observation: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_severity: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Float)
    confidence_note: Mapped[str | None] = mapped_column(String(255))
    suggested_description: Mapped[str] = mapped_column(Text, nullable=False)
    safety_concern: Mapped[str | None] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(String(60), nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(80))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    raw_response: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    report: Mapped[Report | None] = relationship(back_populates="analysis")


class DuplicateSuggestion(Base):
    __tablename__ = "duplicate_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True, nullable=False)
    possible_duplicate_report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"),
                                                              index=True, nullable=False)
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    distance_m: Mapped[float | None] = mapped_column(Float)
    signals: Mapped[str | None] = mapped_column(Text)  # JSON breakdown of each signal
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    review_status: Mapped[str] = mapped_column(String(20), default="pending", index=True, nullable=False)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    report: Mapped[Report] = relationship(foreign_keys=[report_id])
    possible_duplicate: Mapped[Report] = relationship(foreign_keys=[possible_duplicate_report_id])

    __table_args__ = (
        UniqueConstraint("report_id", "possible_duplicate_report_id", name="uq_duplicate_pair"),
        CheckConstraint("report_id <> possible_duplicate_report_id", name="ck_duplicate_not_self"),
        CheckConstraint("review_status IN ('pending','confirmed','rejected')", name="ck_duplicate_status"),
    )


class StatusHistory(Base):
    __tablename__ = "status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), index=True)
    report_id: Mapped[int | None] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    previous_status: Mapped[str | None] = mapped_column(String(20))
    new_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    note: Mapped[str | None] = mapped_column(Text)
    evidence_path: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True, nullable=False)

    changed_by_user: Mapped[User | None] = relationship(foreign_keys=[changed_by])


class AdminNote(Base):
    __tablename__ = "admin_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), index=True, nullable=False)
    admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    incident: Mapped[Incident] = relationship(back_populates="notes")
    admin: Mapped[User | None] = relationship()
