import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import AIAnalysis, Report, User
from app.services import storage_service
from app.services.ai import AIServiceError, get_provider, provider_status
from app.services.serializers import analysis_out
from app.utils.constants import CATEGORIES

router = APIRouter(prefix="/api/ai", tags=["AI analysis"])
logger = logging.getLogger("civiclens.ai")


def _persist(db: Session, user: User, image_path: str, image_hash: str, result, report_id=None) -> AIAnalysis:
    a = AIAnalysis(
        report_id=report_id, user_id=user.id, image_path=image_path, image_hash=image_hash,
        is_civic_issue=result.is_civic_issue, detected_category=result.detected_category,
        visible_observation=result.visible_observation, suggested_severity=result.possible_severity,
        confidence_score=result.confidence_score, confidence_note=result.confidence_note,
        suggested_description=result.suggested_description, safety_concern=result.safety_concern,
        provider=result.analysis_provider, model_name=result.model_name, is_simulated=result.is_simulated,
        raw_response=result.raw_response,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.get("/status")
def ai_status():
    """Which AI provider is active, and whether analysis is simulated."""
    return {**provider_status(), "categories": CATEGORIES}


@router.post("/analyze", status_code=status.HTTP_201_CREATED)
async def analyze(image: UploadFile = File(...), hint: str | None = Form(default=None, max_length=500),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Upload a photo and receive an AI suggestion (or a clearly-labelled simulated one in demo mode).

    The analysis is stored and can be referenced by `analysis_id` when submitting the report.
    """
    data = await storage_service.read_upload(image)
    stored = storage_service.store_image(data, "reports")
    try:
        provider = get_provider()
        result = await run_in_threadpool(provider.analyze, stored.jpeg_bytes, hint)
    except AIServiceError as exc:
        # Report the failure honestly. The citizen can still submit the photo with a manual category.
        logger.warning("AI analysis failed: %s", exc.message)
        stored.absolute_path.unlink(missing_ok=True)
        raise HTTPException(exc.status_code, {"message": exc.message, "manual_entry_allowed": True})
    a = _persist(db, user, stored.relative_path, stored.image_hash, result)
    logger.info("analysis %s by %s provider=%s simulated=%s", a.id, user.id, a.provider, a.is_simulated)
    return analysis_out(a)


@router.post("/analyze/{report_id}", status_code=status.HTTP_201_CREATED)
async def reanalyze(report_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Re-run analysis on an existing report's photo (admin). Replaces the stored analysis."""
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found.")
    if not report.image_path:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This report has no photo to analyse.")
    path = storage_service.resolve_path(report.image_path)
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "The report photo file is missing.")
    try:
        result = await run_in_threadpool(get_provider().analyze, path.read_bytes(), report.description)
    except AIServiceError as exc:
        raise HTTPException(exc.status_code, exc.message)
    if report.analysis:
        db.delete(report.analysis)
        db.flush()
    a = _persist(db, report.user, report.image_path, report.image_hash, result, report_id=report.id)
    return analysis_out(a)
