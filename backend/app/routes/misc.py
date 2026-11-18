"""Priority, analytics, map, admin dashboard, files and health routes."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import or_, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import AIAnalysis, Incident, Report, StatusHistory, User
from app.schemas import NoteIn, PriorityIn
from app.services import analytics_service, priority_service, storage_service
from app.services.ai import provider_status
from app.services.serializers import incident_out, report_out
from app.utils.constants import CATEGORIES, ROLE_ADMIN, SEVERITY_SCORES, STATUSES

# ---------------- Priority ----------------
priority_router = APIRouter(prefix="/api/priority", tags=["Priority"])


@priority_router.get("/config")
def priority_config(user: User = Depends(get_current_user)):
    s = get_settings()
    return {"weights": s.priority_weights, "severity_scores": SEVERITY_SCORES,
            "waiting_full_days": s.PRIORITY_WAITING_FULL_DAYS,
            "levels": {"low": "0–29", "moderate": "30–49", "high": "50–74", "critical": "75–100"},
            "disclaimer": priority_service.DISCLAIMER}


@priority_router.post("/calculate")
def calculate(body: PriorityIn, user: User = Depends(get_current_user)):
    """Calculate a priority score from raw factor values (0–100) — useful for what-if analysis."""
    return priority_service.compute(body.severity, body.reports, body.exposure, body.waiting, body.weights)


@priority_router.get("/{incident_id}")
def incident_priority(incident_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    inc = db.get(Incident, incident_id)
    if inc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found.")
    result = priority_service.apply_to_incident(inc)  # refresh so waiting time is current
    db.commit()
    return {"incident_code": inc.incident_code, **result}


# ---------------- Analytics ----------------
analytics_router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@analytics_router.get("/overview")
def a_overview(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return analytics_service.overview(db)


@analytics_router.get("/categories")
def a_categories(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return analytics_service.categories(db)


@analytics_router.get("/monthly")
def a_monthly(months: int = Query(12, ge=1, le=36), admin: User = Depends(require_admin),
              db: Session = Depends(get_db)):
    return analytics_service.monthly(db, months)


@analytics_router.get("/status")
def a_status(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return analytics_service.status_distribution(db)


@analytics_router.get("/priority")
def a_priority(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return analytics_service.priority_distribution(db)


# ---------------- Map ----------------
map_router = APIRouter(prefix="/api/map", tags=["Map"])


@map_router.get("/incidents")
def map_points(category: str | None = None, status_: str | None = Query(None, alias="status"),
               priority_level: str | None = None, include_reports: bool = True,
               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Incident and ungrouped-report locations. Citizens get a limited public view (no photos or reporter)."""
    is_admin = user.role == ROLE_ADMIN
    stmt = select(Incident)
    if category:
        stmt = stmt.where(Incident.category == category)
    if status_ == "open":
        stmt = stmt.where(Incident.status != "resolved")
    elif status_:
        stmt = stmt.where(Incident.status == status_)
    if priority_level:
        stmt = stmt.where(Incident.priority_level == priority_level)
    incidents = db.scalars(stmt.order_by(Incident.priority_score.desc())).all()
    own_incidents = {r.incident_id for r in db.scalars(select(Report).where(Report.user_id == user.id))}

    def inc_point(i: Incident) -> dict:
        d = incident_out(i)
        d["short_description"] = i.description if len(i.description) <= 160 else i.description[:157] + "..."
        d["involves_you"] = i.id in own_incidents
        if not is_admin:
            for k in ("resolution_image_url", "exposure_override"):
                d.pop(k, None)
        return {"type": "incident", **d}

    reports = []
    if include_reports and not priority_level:
        rstmt = select(Report).where(Report.incident_id.is_(None))
        if category:
            rstmt = rstmt.where(Report.category == category)
        if status_ == "open":
            rstmt = rstmt.where(Report.status != "resolved")
        elif status_:
            rstmt = rstmt.where(Report.status == status_)
        for r in db.scalars(rstmt.order_by(Report.created_at.desc())):
            desc = r.description if len(r.description) <= 160 else r.description[:157] + "..."
            reports.append({"type": "report", "id": r.id, "report_code": r.report_code, "category": r.category,
                            "category_label": CATEGORIES.get(r.category, r.category), "status": r.status,
                            "status_label": STATUSES.get(r.status, r.status), "severity": r.severity,
                            "short_description": desc, "latitude": r.latitude, "longitude": r.longitude,
                            "address": r.address, "is_own": r.user_id == user.id, "is_demo": r.is_demo,
                            "created_at": r.created_at.isoformat()})
    return {"incidents": [inc_point(i) for i in incidents], "reports": reports}


# ---------------- Admin ----------------
admin_router = APIRouter(prefix="/api/admin", tags=["Administration"])


@admin_router.get("/dashboard")
def dashboard(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    recent = db.scalars(select(Report).order_by(Report.created_at.desc(), Report.id.desc()).limit(8)).all()
    top = db.scalars(select(Incident).where(Incident.status != "resolved")
                     .order_by(Incident.priority_score.desc()).limit(6)).all()
    return {
        "overview": analytics_service.overview(db),
        "recent_reports": [report_out(r, admin) for r in recent],
        "top_incidents": [incident_out(i, admin) for i in top],
        "categories": analytics_service.categories(db),
        "status": analytics_service.status_distribution(db),
        "monthly": analytics_service.monthly(db, 6),
        "priority": analytics_service.priority_distribution(db),
    }


@admin_router.get("/reports")
def admin_reports(category: str | None = None, severity: str | None = None,
                  status_: str | None = Query(None, alias="status"), q: str | None = Query(None, max_length=100),
                  date_from: str | None = None, date_to: str | None = None, grouped: bool | None = None,
                  page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from datetime import date as _date

    from app.routes.reports import query_reports
    df = _date.fromisoformat(date_from) if date_from else None
    dt = _date.fromisoformat(date_to) if date_to else None
    res = query_reports(db, category=category, severity=severity, status_=status_, date_from=df, date_to=dt,
                        q=q, grouped=grouped, page=page, page_size=page_size)
    return {**res, "rows": [report_out(r, admin) for r in res["rows"]]}


@admin_router.get("/incidents")
def admin_incidents(category: str | None = None, status_: str | None = Query(None, alias="status"),
                    priority_level: str | None = None, q: str | None = Query(None, max_length=100),
                    sort: str = Query("priority", pattern="^(priority|newest|updated)$"),
                    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                    admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.routes.incidents import query_incidents
    total, rows = query_incidents(db, category=category, status_=status_, priority_level=priority_level, q=q,
                                  sort=sort, page=page, page_size=page_size)
    return {"total": total, "page": page, "page_size": page_size, "rows": [incident_out(i, admin) for i in rows]}


@admin_router.post("/incidents/{incident_id}/notes", status_code=status.HTTP_201_CREATED)
def admin_note(incident_id: int, body: NoteIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.routes.incidents import add_note
    return add_note(incident_id, body, admin, db)


# ---------------- Files ----------------
files_router = APIRouter(prefix="/api/files", tags=["Files"])


@files_router.get("/{path:path}")
def get_file(path: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Serve an uploaded image only to users authorised to see it."""
    abs_path = storage_service.resolve_path(path)
    if abs_path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    if user.role != ROLE_ADMIN:
        own_report = db.scalar(select(Report.id).where(Report.image_path == path, Report.user_id == user.id))
        own_analysis = db.scalar(select(AIAnalysis.id).where(AIAnalysis.image_path == path,
                                                             AIAnalysis.user_id == user.id))
        own_incident_ids = select(Report.incident_id).where(Report.user_id == user.id,
                                                            Report.incident_id.is_not(None))
        evidence = db.scalar(select(Incident.id).where(Incident.resolution_image_path == path,
                                                       Incident.id.in_(own_incident_ids)))
        hist_evidence = db.scalar(select(StatusHistory.id).where(StatusHistory.evidence_path == path, or_(
            StatusHistory.incident_id.in_(own_incident_ids),
            StatusHistory.report_id.in_(select(Report.id).where(Report.user_id == user.id)))))
        if not (own_report or own_analysis or evidence or hist_evidence):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    return FileResponse(abs_path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})


# ---------------- Health / meta ----------------
health_router = APIRouter(prefix="/api", tags=["Health"])


@health_router.get("/health")
def health(db: Session = Depends(get_db)):
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # pragma: no cover
        db_ok = False
    s = get_settings()
    return {"status": "ok" if db_ok else "degraded", "database": "ok" if db_ok else "error",
            "app": s.APP_NAME, "environment": s.APP_ENV, "ai": provider_status(),
            "demo_data_enabled": s.SEED_DEMO_DATA}


@health_router.get("/meta")
def meta():
    """Reference data used by the frontend (categories, statuses, severities)."""
    return {"categories": CATEGORIES, "statuses": STATUSES, "severities": list(SEVERITY_SCORES.keys()),
            "priority_weights": get_settings().priority_weights,
            "duplicate_thresholds": {"max_distance_m": get_settings().DUP_MAX_DISTANCE_M,
                                     "time_window_days": get_settings().DUP_TIME_WINDOW_DAYS,
                                     "min_score": get_settings().DUP_MIN_SCORE}}

