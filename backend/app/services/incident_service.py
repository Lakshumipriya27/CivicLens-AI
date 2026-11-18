"""Incident lifecycle: grouping reports, merging incidents, status changes."""
from collections import Counter

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import AdminNote, DuplicateSuggestion, Incident, Report, StatusHistory, User, utcnow
from app.services import priority_service
from app.utils.constants import (DUP_CONFIRMED, DUP_PENDING, STATUS_RESOLVED, STATUS_SUBMITTED,
                                 STATUS_TRANSITIONS, STATUS_UNDER_REVIEW, STATUSES)
from app.utils.helpers import make_code


def _recompute_location(incident: Incident) -> None:
    reps = incident.reports
    if reps:
        incident.latitude = sum(r.latitude for r in reps) / len(reps)
        incident.longitude = sum(r.longitude for r in reps) / len(reps)
        if not incident.address:
            incident.address = next((r.address for r in reps if r.address), None)


def _sync_suggestions(db: Session, incident: Incident, admin: User | None) -> None:
    """Pending suggestions between reports that are now in the same incident are resolved as confirmed."""
    ids = [r.id for r in incident.reports]
    if len(ids) < 2:
        return
    for sug in db.scalars(select(DuplicateSuggestion).where(
            DuplicateSuggestion.review_status == DUP_PENDING,
            DuplicateSuggestion.report_id.in_(ids),
            DuplicateSuggestion.possible_duplicate_report_id.in_(ids))):
        sug.review_status = DUP_CONFIRMED
        sug.reviewed_by = admin.id if admin else None
        sug.reviewed_at = utcnow()


def _absorb_incident(db: Session, target: Incident, source: Incident) -> None:
    """Move everything from `source` into `target` and delete the now-empty source incident."""
    db.execute(update(StatusHistory).where(StatusHistory.incident_id == source.id)
               .values(incident_id=target.id))
    db.execute(update(AdminNote).where(AdminNote.incident_id == source.id).values(incident_id=target.id))
    db.add(AdminNote(incident_id=target.id, admin_id=None,
                     note=f"System: merged incident {source.incident_code} into this incident."))
    db.flush()
    db.expire(source)
    db.delete(source)


def attach_reports(db: Session, incident: Incident, reports: list[Report], admin: User | None,
                   note: str | None = None) -> Incident:
    for rep in reports:
        if rep.incident_id == incident.id:
            continue
        old = rep.incident
        rep.incident = incident
        prev = rep.status
        rep.status = incident.status
        db.add(StatusHistory(report_id=rep.id, incident_id=incident.id, previous_status=prev,
                             new_status=incident.status, changed_by=admin.id if admin else None,
                             note=note or f"Linked to incident {incident.incident_code} after administrator review."))
        if old is not None and old.id != incident.id:
            db.flush()
            db.refresh(old)
            if not old.reports:
                _absorb_incident(db, incident, old)
            else:
                priority_service.apply_to_incident(old)
                _recompute_location(old)
    db.flush()
    db.refresh(incident)
    incident.is_demo = bool(incident.reports) and all(r.is_demo for r in incident.reports)
    _recompute_location(incident)
    priority_service.apply_to_incident(incident)
    _sync_suggestions(db, incident, admin)
    return incident


def create_incident(db: Session, reports: list[Report], admin: User | None, *,
                    description: str | None = None, category: str | None = None,
                    note: str | None = None) -> Incident:
    if not reports:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one report is required.")
    cat = category or Counter(r.category for r in reports).most_common(1)[0][0]
    first = min(reports, key=lambda r: r.created_at)
    incident = Incident(
        incident_code=make_code("INC"),
        category=cat,
        description=description or first.description,
        latitude=first.latitude, longitude=first.longitude, address=first.address,
        severity=first.severity, status=STATUS_UNDER_REVIEW,
        is_demo=all(r.is_demo for r in reports),
        created_by=admin.id if admin else None,
    )
    db.add(incident)
    db.flush()
    db.add(StatusHistory(incident_id=incident.id, previous_status=None, new_status=STATUS_UNDER_REVIEW,
                         changed_by=admin.id if admin else None,
                         note=note or f"Incident created from {len(reports)} report(s)."))
    return attach_reports(db, incident, reports, admin)


def change_status(db: Session, incident: Incident, new_status: str, admin: User, note: str | None,
                  evidence_path: str | None = None) -> Incident:
    if new_status not in STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown status.")
    prev = incident.status
    if new_status == prev:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Incident is already '{STATUSES[prev]}'.")
    if new_status not in STATUS_TRANSITIONS.get(prev, set()):
        allowed = ", ".join(STATUSES[s] for s in sorted(STATUS_TRANSITIONS.get(prev, set())))
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Cannot move from '{STATUSES[prev]}' to '{STATUSES[new_status]}'. Allowed: {allowed}.")
    if new_status == STATUS_RESOLVED and not (note or evidence_path):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add a resolution note or evidence photo to resolve.")

    incident.status = new_status
    if new_status == STATUS_RESOLVED:
        incident.resolved_at = utcnow()
        incident.resolution_note = note
        if evidence_path:
            incident.resolution_image_path = evidence_path
    elif prev == STATUS_RESOLVED:
        incident.resolved_at = None
    db.add(StatusHistory(incident_id=incident.id, previous_status=prev, new_status=new_status,
                         changed_by=admin.id, note=note, evidence_path=evidence_path))
    for rep in incident.reports:
        rep.status = new_status
    priority_service.apply_to_incident(incident)
    db.flush()
    return incident


def ensure_report_history(db: Session, report: Report, user: User) -> None:
    db.add(StatusHistory(report_id=report.id, previous_status=None, new_status=STATUS_SUBMITTED,
                         changed_by=user.id, note="Report submitted by citizen."))
