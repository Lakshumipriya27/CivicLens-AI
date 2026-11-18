"""Convert ORM objects to API dictionaries, applying role-based field visibility."""
import json

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import AIAnalysis, DuplicateSuggestion, Incident, Report, StatusHistory, User
from app.schemas import AnalysisOut
from app.utils.constants import CATEGORIES, ROLE_ADMIN, STATUSES


def file_url(path: str | None) -> str | None:
    return f"/api/files/{path}" if path else None


def analysis_out(a: AIAnalysis | None) -> dict | None:
    if a is None:
        return None
    d = AnalysisOut.model_validate(a).model_dump(mode="json")
    d["category_label"] = CATEGORIES.get(a.detected_category, a.detected_category)
    d["image_url"] = file_url(a.image_path)
    return d


def report_out(r: Report, viewer: User, detail: bool = False) -> dict:
    is_admin = viewer.role == ROLE_ADMIN
    d = {
        "id": r.id,
        "report_code": r.report_code,
        "category": r.category,
        "category_label": CATEGORIES.get(r.category, r.category),
        "description": r.description,
        "image_url": file_url(r.image_path),
        "latitude": r.latitude,
        "longitude": r.longitude,
        "address": r.address,
        "severity": r.severity,
        "status": r.status,
        "status_label": STATUSES.get(r.status, r.status),
        "incident_id": r.incident_id,
        "incident_code": r.incident.incident_code if r.incident else None,
        "is_demo": r.is_demo,
        "is_own": r.user_id == viewer.id,
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    }
    if is_admin:
        d["reporter"] = {"id": r.user.id, "full_name": r.user.full_name}
    if detail:
        d["analysis"] = analysis_out(r.analysis)
        if r.incident:
            d["incident"] = {
                "id": r.incident.id, "incident_code": r.incident.incident_code,
                "status": r.incident.status, "priority_score": r.incident.priority_score,
                "priority_level": r.incident.priority_level,
                "supporting_report_count": r.incident.supporting_report_count,
                "resolution_note": r.incident.resolution_note,
                "resolution_image_url": file_url(r.incident.resolution_image_path),
            }
    return d


def history_out(rows: list[StatusHistory], viewer: User) -> list[dict]:
    out = []
    for h in rows:
        item = {
            "id": h.id,
            "previous_status": h.previous_status,
            "new_status": h.new_status,
            "new_status_label": STATUSES.get(h.new_status, h.new_status),
            "note": h.note,
            "evidence_url": file_url(h.evidence_path),
            "incident_id": h.incident_id,
            "report_id": h.report_id,
            "created_at": h.created_at.isoformat(),
        }
        if viewer.role == ROLE_ADMIN:
            item["changed_by"] = h.changed_by_user.full_name if h.changed_by_user else "System"
        else:
            item["changed_by"] = ("You" if h.changed_by == viewer.id else "City administration")
        out.append(item)
    return out


def report_history(db: Session, r: Report) -> list[StatusHistory]:
    cond = StatusHistory.report_id == r.id
    if r.incident_id:
        cond = or_(cond, (StatusHistory.incident_id == r.incident_id) & (StatusHistory.report_id.is_(None)))
    return list(db.scalars(select(StatusHistory).where(cond).order_by(StatusHistory.created_at,
                                                                      StatusHistory.id)))


def incident_out(i: Incident, viewer: User | None = None, detail: bool = False) -> dict:
    d = {
        "id": i.id,
        "incident_code": i.incident_code,
        "category": i.category,
        "category_label": CATEGORIES.get(i.category, i.category),
        "description": i.description,
        "latitude": i.latitude,
        "longitude": i.longitude,
        "address": i.address,
        "severity": i.severity,
        "priority_score": i.priority_score,
        "priority_level": i.priority_level,
        "status": i.status,
        "status_label": STATUSES.get(i.status, i.status),
        "supporting_report_count": i.supporting_report_count,
        "exposure_override": i.exposure_override,
        "resolution_note": i.resolution_note,
        "resolution_image_url": file_url(i.resolution_image_path),
        "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
        "is_demo": i.is_demo,
        "created_at": i.created_at.isoformat(),
        "updated_at": i.updated_at.isoformat(),
    }
    if detail:
        d["priority_breakdown"] = json.loads(i.priority_breakdown) if i.priority_breakdown else None
    return d


def suggestion_out(s: DuplicateSuggestion, viewer: User) -> dict:
    sig = json.loads(s.signals) if s.signals else None
    return {
        "id": s.id,
        "similarity_score": s.similarity_score,
        "distance_m": s.distance_m,
        "signals": sig,
        "explanation": s.explanation,
        "review_status": s.review_status,
        "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
        "created_at": s.created_at.isoformat(),
        "report": report_out(s.report, viewer),
        "possible_duplicate": report_out(s.possible_duplicate, viewer),
        "same_incident": bool(s.report.incident_id and s.report.incident_id == s.possible_duplicate.incident_id),
    }


def public_candidate(other: Report, res: dict) -> dict:
    """Limited view of another citizen's report, used for pre-submission duplicate hints."""
    desc = other.description
    return {
        "report_code": other.report_code,
        "incident_code": other.incident.incident_code if other.incident else None,
        "category": other.category,
        "category_label": CATEGORIES.get(other.category, other.category),
        "status": other.status,
        "status_label": STATUSES.get(other.status, other.status),
        "short_description": desc if len(desc) <= 140 else desc[:137] + "...",
        "distance_m": res["distance_m"],
        "match_score": res["score"],
        "category_match": res["category_match"],
        "signals": res["signals"],
        "explanation": res["explanation"],
        "created_at": other.created_at.isoformat(),
        "is_demo": other.is_demo,
    }
