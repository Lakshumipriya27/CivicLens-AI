from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import AIAnalysis, DuplicateSuggestion, User, utcnow
from app.schemas import DuplicateCheckIn, DuplicateReviewIn
from app.services import duplicate_service, incident_service
from app.services.serializers import incident_out, public_candidate, suggestion_out
from app.utils.constants import CATEGORIES, DUP_CONFIRMED, DUP_PENDING, DUP_REJECTED

router = APIRouter(prefix="/api/duplicates", tags=["Duplicate detection"])


@router.post("/check")
def check(body: DuplicateCheckIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Pre-submission check: likely matching reports near this location (limited public view)."""
    if body.category not in CATEGORIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown category.")
    image_hash = None
    if body.analysis_id:
        a = db.get(AIAnalysis, body.analysis_id)
        if a is None or a.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found.")
        image_hash = a.image_hash
    cands = duplicate_service.find_candidates(db, lat=body.latitude, lng=body.longitude, category=body.category,
                                              description=body.description, image_hash=image_hash)
    return {
        "candidates": [public_candidate(o, r) for o, r in cands],
        "note": "These are AI-assisted suggestions, not confirmed duplicates. Your report will still be "
                "recorded individually; an administrator decides whether reports describe the same incident.",
    }


@router.get("")
def list_suggestions(review_status: str = Query(DUP_PENDING, pattern="^(pending|confirmed|rejected|all)$"),
                     page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                     admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    stmt = select(DuplicateSuggestion)
    if review_status != "all":
        stmt = stmt.where(DuplicateSuggestion.review_status == review_status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(DuplicateSuggestion.similarity_score.desc(), DuplicateSuggestion.id.desc())
                      .offset((page - 1) * page_size).limit(page_size)).all()
    return {"total": total, "page": page, "page_size": page_size,
            "rows": [suggestion_out(s, admin) for s in rows]}


@router.get("/{report_id}")
def for_report(report_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(DuplicateSuggestion).where(or_(
        DuplicateSuggestion.report_id == report_id,
        DuplicateSuggestion.possible_duplicate_report_id == report_id))
        .order_by(DuplicateSuggestion.similarity_score.desc())).all()
    return [suggestion_out(s, admin) for s in rows]


@router.post("/{suggestion_id}/review")
def review(suggestion_id: int, body: DuplicateReviewIn, admin: User = Depends(require_admin),
           db: Session = Depends(get_db)):
    """Confirm (group both reports into one incident) or reject a duplicate suggestion."""
    sug = db.get(DuplicateSuggestion, suggestion_id)
    if sug is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Suggestion not found.")
    if sug.review_status != DUP_PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Suggestion was already {sug.review_status}.")
    incident = None
    if body.decision == "reject":
        sug.review_status = DUP_REJECTED
    else:
        a, b = sug.report, sug.possible_duplicate
        target = b.incident or a.incident
        note = body.note or f"Confirmed as duplicate of {b.report_code} by administrator review."
        if target is None:
            incident = incident_service.create_incident(db, [b, a], admin, note=note)
        else:
            incident = incident_service.attach_reports(db, target, [a, b], admin, note=note)
        sug.review_status = DUP_CONFIRMED
    sug.reviewed_by = admin.id
    sug.reviewed_at = utcnow()
    db.commit()
    return {"suggestion": suggestion_out(sug, admin),
            "incident": incident_out(incident, admin) if incident else None}
