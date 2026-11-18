"""Multi-signal duplicate detection.

Signals: geographic proximity, category similarity, text similarity, time proximity and
perceptual image similarity (dHash). Candidates outside the distance / time window are ignored.
A suggestion is never proof: reports are only grouped after an administrator confirms.
"""
import json
import math
from datetime import datetime, timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import DuplicateSuggestion, Report, utcnow
from app.utils.constants import CATEGORIES, DUP_PENDING, category_similarity
from app.utils.helpers import hash_similarity, haversine_m, text_similarity

BASE_WEIGHTS = {"distance": 0.35, "category": 0.30, "text": 0.15, "time": 0.10, "image": 0.10}


def score_pair(*, lat: float, lng: float, category: str, description: str, created_at: datetime,
               image_hash: str | None, other: Report) -> dict | None:
    s = get_settings()
    dist = haversine_m(lat, lng, other.latitude, other.longitude)
    if dist > s.DUP_MAX_DISTANCE_M:
        return None
    gap_days = abs((created_at - other.created_at).total_seconds()) / 86400
    if gap_days > s.DUP_TIME_WINDOW_DAYS:
        return None

    signals = {
        "distance": 1 - dist / s.DUP_MAX_DISTANCE_M,
        "category": category_similarity(category, other.category),
        "text": text_similarity(description, other.description),
        "time": math.exp(-gap_days / max(1, s.DUP_TIME_WINDOW_DAYS / 3)),
    }
    img_sim = hash_similarity(image_hash, other.image_hash)
    weights = dict(BASE_WEIGHTS)
    if img_sim is None:
        weights.pop("image")
    else:
        # Map Hamming similarity: <=0.6 is noise for dHash, >=0.9 is a near-identical photo.
        signals["image"] = max(0.0, min(1.0, (img_sim - 0.6) / 0.3))
    total = sum(weights.values())
    score = sum(signals[k] * weights[k] for k in weights) / total
    if signals["category"] == 0:
        score *= 0.6  # different, unrelated categories rarely describe the same incident

    parts = [f"{dist:.0f} m apart"]
    if signals["category"] == 1:
        parts.append(f"same category ({CATEGORIES.get(category, category)})")
    elif signals["category"] > 0:
        parts.append("related categories")
    else:
        parts.append("different categories")
    if signals["text"] >= 0.35:
        parts.append(f"similar descriptions ({signals['text']:.0%} word overlap)")
    if gap_days < 1:
        parts.append("reported within 24 hours")
    else:
        parts.append(f"reported {gap_days:.0f} day(s) apart")
    if "image" in signals and signals["image"] >= 0.5:
        parts.append("visually similar photographs")

    return {
        "score": round(score, 3),
        "distance_m": round(dist, 1),
        "signals": {k: round(v, 3) for k, v in signals.items()},
        "weights": {k: round(v / total, 3) for k, v in weights.items()},
        "category_match": signals["category"] == 1,
        "explanation": "Possible match: " + ", ".join(parts) + ".",
    }


def _bbox(lat: float, lng: float, meters: float):
    dlat = meters / 111_320
    dlng = meters / (111_320 * max(0.1, math.cos(math.radians(lat))))
    return lat - dlat, lat + dlat, lng - dlng, lng + dlng


def find_candidates(db: Session, *, lat: float, lng: float, category: str, description: str,
                    image_hash: str | None, created_at: datetime | None = None,
                    exclude_report_id: int | None = None, limit: int = 5) -> list[tuple[Report, dict]]:
    s = get_settings()
    created_at = created_at or utcnow()
    lat0, lat1, lng0, lng1 = _bbox(lat, lng, s.DUP_MAX_DISTANCE_M)
    window = timedelta(days=s.DUP_TIME_WINDOW_DAYS)
    q = select(Report).where(
        Report.latitude.between(lat0, lat1), Report.longitude.between(lng0, lng1),
        Report.created_at.between(created_at - window, created_at + window),
    )
    if exclude_report_id:
        q = q.where(Report.id != exclude_report_id)
    out = []
    for other in db.scalars(q):
        res = score_pair(lat=lat, lng=lng, category=category, description=description,
                         created_at=created_at, image_hash=image_hash, other=other)
        if res and res["score"] >= s.DUP_MIN_SCORE:
            out.append((other, res))
    out.sort(key=lambda x: x[1]["score"], reverse=True)
    return out[:limit]


def generate_for_report(db: Session, report: Report) -> list[DuplicateSuggestion]:
    """Store pending suggestions linking a newly submitted report to likely matches."""
    created = []
    for other, res in find_candidates(db, lat=report.latitude, lng=report.longitude, category=report.category,
                                      description=report.description, image_hash=report.image_hash,
                                      created_at=report.created_at, exclude_report_id=report.id):
        if report.incident_id and report.incident_id == other.incident_id:
            continue
        exists = db.scalar(select(DuplicateSuggestion).where(or_(
            and_(DuplicateSuggestion.report_id == report.id,
                 DuplicateSuggestion.possible_duplicate_report_id == other.id),
            and_(DuplicateSuggestion.report_id == other.id,
                 DuplicateSuggestion.possible_duplicate_report_id == report.id))))
        if exists:
            continue
        sug = DuplicateSuggestion(report_id=report.id, possible_duplicate_report_id=other.id,
                                  similarity_score=res["score"], distance_m=res["distance_m"],
                                  signals=json.dumps({"signals": res["signals"], "weights": res["weights"]}),
                                  explanation=res["explanation"], review_status=DUP_PENDING)
        db.add(sug)
        created.append(sug)
    db.flush()
    return created
