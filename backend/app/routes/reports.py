import logging
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import AIAnalysis, DuplicateSuggestion, Report, StatusHistory, User
from app.schemas import ReportUpdateIn
from app.services import duplicate_service, incident_service, storage_service
from app.services.serializers import history_out, report_history, report_out, suggestion_out
from app.utils.constants import CATEGORIES, ROLE_ADMIN, SEVERITIES, STATUS_SUBMITTED, STATUSES
from app.utils.helpers import make_code

router = APIRouter(prefix="/api/reports", tags=["Reports"])
logger = logging.getLogger("civiclens.reports")


def get_report_for(db: Session, report_id: int, user: User) -> Report:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found.")
    if user.role != ROLE_ADMIN and report.user_id != user.id:
        # Do not reveal whether someone else's report exists.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found.")
    return report


def query_reports(db: Session, *, user_id: int | None = None, category: str | None = None,
                  severity: str | None = None, status_: str | None = None, date_from: date | None = None,
                  date_to: date | None = None, q: str | None = None, grouped: bool | None = None,
                  page: int = 1, page_size: int = 20) -> dict:
    stmt = select(Report)
    if user_id is not None:
        stmt = stmt.where(Report.user_id == user_id)
    if category:
        stmt = stmt.where(Report.category == category)
    if severity:
        stmt = stmt.where(Report.severity == severity)
    if status_:
        stmt = stmt.where(Report.status == status_)
    if date_from:
        stmt = stmt.where(Report.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(Report.created_at <= datetime.combine(date_to, time.max))
    if grouped is True:
        stmt = stmt.where(Report.incident_id.is_not(None))
    elif grouped is False:
        stmt = stmt.where(Report.incident_id.is_(None))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Report.report_code.ilike(like), Report.description.ilike(like),
                              Report.address.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Report.created_at.desc(), Report.id.desc())
                      .offset((page - 1) * page_size).limit(page_size)).all()
    return {"total": total, "page": page, "page_size": page_size, "rows": rows}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_report(
    category: str = Form(...),
    description: str = Form(..., min_length=5, max_length=2000),
    latitude: float = Form(..., ge=-90, le=90),
    longitude: float = Form(..., ge=-180, le=180),
    severity: str = Form("medium"),
    address: str | None = Form(default=None, max_length=255),
    analysis_id: int | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a report. Either reference a prior `analysis_id` (photo already uploaded) or attach `image`."""
    if category not in CATEGORIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown category.")
    if severity not in SEVERITIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown severity.")

    analysis = None
    if analysis_id is not None:
        analysis = db.get(AIAnalysis, analysis_id)
        if analysis is None or analysis.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found.")
        if analysis.report_id is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "This analysis is already attached to a report.")
        image_path, image_hash = analysis.image_path, analysis.image_hash
    elif image is not None and image.filename:
        stored = storage_service.store_image(await storage_service.read_upload(image), "reports")
        image_path, image_hash = stored.relative_path, stored.image_hash
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A photograph is required.")

    report = Report(report_code=make_code("CL"), user_id=user.id, category=category,
                    description=" ".join(description.split()), image_path=image_path, image_hash=image_hash,
                    latitude=latitude, longitude=longitude, address=(address or "").strip() or None,
                    severity=severity, status=STATUS_SUBMITTED)
    db.add(report)
    db.flush()
    if analysis:
        analysis.report_id = report.id
    incident_service.ensure_report_history(db, report, user)
    suggestions = duplicate_service.generate_for_report(db, report)
    db.commit()
    db.refresh(report)
    logger.info("report %s created by user %s (%d duplicate suggestions)", report.report_code, user.id,
                len(suggestions))
    out = report_out(report, user, detail=True)
    out["duplicate_suggestion_count"] = len(suggestions)
    return out


@router.get("")
def list_reports(
    category: str | None = None, severity: str | None = None, status_: str | None = Query(None, alias="status"),
    date_from: date | None = None, date_to: date | None = None, q: str | None = Query(None, max_length=100),
    grouped: bool | None = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    """Admins see all reports; citizens only see their own."""
    res = query_reports(db, user_id=None if user.role == ROLE_ADMIN else user.id, category=category,
                        severity=severity, status_=status_, date_from=date_from, date_to=date_to, q=q,
                        grouped=grouped, page=page, page_size=page_size)
    return {**res, "rows": [report_out(r, user) for r in res["rows"]]}


@router.get("/my-reports")
def my_reports(status_: str | None = Query(None, alias="status"), page: int = Query(1, ge=1),
               page_size: int = Query(50, ge=1, le=100),
               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    res = query_reports(db, user_id=user.id, status_=status_, page=page, page_size=page_size)
    return {**res, "rows": [report_out(r, user) for r in res["rows"]]}


@router.get("/{report_id}")
def get_report(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = get_report_for(db, report_id, user)
    out = report_out(report, user, detail=True)
    out["history"] = history_out(report_history(db, report), user)
    if user.role == ROLE_ADMIN:
        sugs = db.scalars(select(DuplicateSuggestion).where(or_(
            DuplicateSuggestion.report_id == report.id,
            DuplicateSuggestion.possible_duplicate_report_id == report.id))
            .order_by(DuplicateSuggestion.similarity_score.desc())).all()
        out["duplicate_suggestions"] = [suggestion_out(s, user) for s in sugs]
    return out


@router.patch("/{report_id}")
def update_report(report_id: int, body: ReportUpdateIn, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    report = get_report_for(db, report_id, user)
    is_admin = user.role == ROLE_ADMIN
    if not is_admin:
        if report.status != STATUS_SUBMITTED or report.incident_id:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                "This report is already being handled and can no longer be edited.")
        if body.status is not None or body.severity is not None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only administrators can change status or severity.")
    for field in ("category", "description", "address", "severity"):
        val = getattr(body, field)
        if val is not None:
            setattr(report, field, val)
    if body.status is not None and body.status != report.status:
        if report.incident_id:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                "This report is linked to an incident; update the incident status instead.")
        db.add(StatusHistory(report_id=report.id, previous_status=report.status, new_status=body.status,
                             changed_by=user.id, note=body.note))
        report.status = body.status
    if report.incident and is_admin:
        from app.services import priority_service
        priority_service.apply_to_incident(report.incident)
    db.commit()
    db.refresh(report)
    return report_out(report, user, detail=True)
