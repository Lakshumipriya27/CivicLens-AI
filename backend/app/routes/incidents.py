from datetime import date, datetime, time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import AdminNote, Incident, Report, StatusHistory, User
from app.schemas import GroupIn, IncidentCreateIn, IncidentUpdateIn, NoteIn
from app.services import incident_service, priority_service, storage_service
from app.services.serializers import history_out, incident_out, report_out
from app.utils.constants import CATEGORIES, ROLE_ADMIN, STATUSES

router = APIRouter(prefix="/api/incidents", tags=["Incidents"])


def get_incident(db: Session, incident_id: int) -> Incident:
    inc = db.get(Incident, incident_id)
    if inc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found.")
    return inc


def _load_reports(db: Session, ids: list[int]) -> list[Report]:
    reports = db.scalars(select(Report).where(Report.id.in_(set(ids)))).all()
    if len(reports) != len(set(ids)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "One or more reports were not found.")
    return list(reports)


def query_incidents(db: Session, *, category=None, status_=None, priority_level=None, q=None,
                    date_from: date | None = None, date_to: date | None = None, sort="priority",
                    page=1, page_size=20):
    stmt = select(Incident)
    if category:
        stmt = stmt.where(Incident.category == category)
    if status_ == "open":
        stmt = stmt.where(Incident.status != "resolved")
    elif status_:
        stmt = stmt.where(Incident.status == status_)
    if priority_level:
        stmt = stmt.where(Incident.priority_level == priority_level)
    if date_from:
        stmt = stmt.where(Incident.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(Incident.created_at <= datetime.combine(date_to, time.max))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Incident.incident_code.ilike(like), Incident.description.ilike(like),
                              Incident.address.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    order = {"priority": Incident.priority_score.desc(), "newest": Incident.created_at.desc(),
             "updated": Incident.updated_at.desc()}.get(sort, Incident.priority_score.desc())
    rows = db.scalars(stmt.order_by(order, Incident.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return total, rows


@router.get("")
def list_incidents(category: str | None = None, status_: str | None = Query(None, alias="status"),
                   priority_level: str | None = None, q: str | None = Query(None, max_length=100),
                   date_from: date | None = None, date_to: date | None = None,
                   sort: str = Query("priority", pattern="^(priority|newest|updated)$"),
                   page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                   admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    total, rows = query_incidents(db, category=category, status_=status_, priority_level=priority_level, q=q,
                                  date_from=date_from, date_to=date_to, sort=sort, page=page, page_size=page_size)
    return {"total": total, "page": page, "page_size": page_size, "rows": [incident_out(i, admin) for i in rows]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_incident(body: IncidentCreateIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Create an incident from one or more reports (e.g. promote a single verified report)."""
    if body.category and body.category not in CATEGORIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown category.")
    reports = _load_reports(db, body.report_ids)
    inc = incident_service.create_incident(db, reports, admin, description=body.description,
                                           category=body.category, note=body.note)
    db.commit()
    db.refresh(inc)
    return incident_out(inc, admin, detail=True)


@router.get("/{incident_id}")
def incident_detail(incident_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inc = get_incident(db, incident_id)
    is_admin = user.role == ROLE_ADMIN
    if not is_admin and not any(r.user_id == user.id for r in inc.reports):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found.")
    out = incident_out(inc, user, detail=True)
    hist = db.scalars(select(StatusHistory).where(StatusHistory.incident_id == inc.id)
                      .order_by(StatusHistory.created_at, StatusHistory.id)).all()
    if not is_admin:
        hist = [h for h in hist if h.report_id is None or any(r.id == h.report_id and r.user_id == user.id
                                                               for r in inc.reports)]
    out["history"] = history_out(list(hist), user)
    if is_admin:
        out["reports"] = [report_out(r, user, detail=True) for r in
                          sorted(inc.reports, key=lambda r: r.created_at)]
        out["notes"] = [{"id": n.id, "note": n.note, "admin": n.admin.full_name if n.admin else "System",
                         "created_at": n.created_at.isoformat()} for n in inc.notes]
    else:
        out["reports"] = [report_out(r, user) for r in inc.reports if r.user_id == user.id]
    return out


@router.patch("/{incident_id}")
def update_incident(incident_id: int, body: IncidentUpdateIn, admin: User = Depends(require_admin),
                    db: Session = Depends(get_db)):
    inc = get_incident(db, incident_id)
    if body.category is not None:
        if body.category not in CATEGORIES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown category.")
        inc.category = body.category
    if body.description is not None:
        inc.description = body.description
    if body.address is not None:
        inc.address = body.address or None
    if body.clear_exposure_override:
        inc.exposure_override = None
    elif body.exposure_override is not None:
        inc.exposure_override = body.exposure_override
    priority_service.apply_to_incident(inc)
    db.commit()
    db.refresh(inc)
    return incident_out(inc, admin, detail=True)


@router.post("/{incident_id}/group")
def group_reports(incident_id: int, body: GroupIn, admin: User = Depends(require_admin),
                  db: Session = Depends(get_db)):
    """Link additional reports to this incident (administrator-confirmed grouping)."""
    inc = get_incident(db, incident_id)
    reports = _load_reports(db, body.report_ids)
    inc = incident_service.attach_reports(db, inc, reports, admin, note=body.note)
    db.commit()
    db.refresh(inc)
    return incident_out(inc, admin, detail=True)


@router.patch("/{incident_id}/status")
async def update_status(incident_id: int, new_status: str = Form(...),
                        note: str | None = Form(default=None, max_length=2000),
                        evidence: UploadFile | None = File(default=None),
                        admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Move the incident through its lifecycle. Optional resolution evidence photo."""
    inc = get_incident(db, incident_id)
    if new_status not in STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown status.")
    evidence_path = None
    if evidence is not None and evidence.filename:
        evidence_path = storage_service.store_image(await storage_service.read_upload(evidence),
                                                    "evidence").relative_path
    inc = incident_service.change_status(db, inc, new_status, admin, (note or "").strip() or None, evidence_path)
    db.commit()
    db.refresh(inc)
    return incident_out(inc, admin, detail=True)


@router.post("/{incident_id}/notes", status_code=status.HTTP_201_CREATED)
def add_note(incident_id: int, body: NoteIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    inc = get_incident(db, incident_id)
    n = AdminNote(incident_id=inc.id, admin_id=admin.id, note=body.note.strip())
    db.add(n)
    db.commit()
    return {"id": n.id, "note": n.note, "admin": admin.full_name, "created_at": n.created_at.isoformat()}
