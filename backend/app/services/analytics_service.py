"""Analytics computed from actual database records only."""
from collections import Counter
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DuplicateSuggestion, Incident, Report, utcnow
from app.utils.constants import CATEGORIES, DUP_PENDING, STATUSES


def overview(db: Session) -> dict:
    count = lambda stmt: db.scalar(stmt) or 0  # noqa: E731
    total_reports = count(select(func.count(Report.id)))
    total_incidents = count(select(func.count(Incident.id)))
    ungrouped_pending = count(select(func.count(Report.id)).where(
        Report.incident_id.is_(None), Report.status.in_(["submitted", "under_review"])))
    pending_dups = count(select(func.count(DuplicateSuggestion.id)).where(
        DuplicateSuggestion.review_status == DUP_PENDING))
    by_status = dict(db.execute(select(Incident.status, func.count()).group_by(Incident.status)).all())
    critical_open = count(select(func.count(Incident.id)).where(
        Incident.priority_level == "critical", Incident.status != "resolved"))
    resolved = db.scalars(select(Incident).where(Incident.status == "resolved",
                                                 Incident.resolved_at.is_not(None))).all()
    avg_days = None
    if resolved:
        avg_days = round(sum((i.resolved_at - i.created_at).total_seconds() for i in resolved)
                         / len(resolved) / 86400, 1)
    return {
        "total_reports": total_reports,
        "total_incidents": total_incidents,
        "pending_reviews": ungrouped_pending,
        "pending_duplicate_suggestions": pending_dups,
        "in_progress_incidents": by_status.get("in_progress", 0),
        "resolved_incidents": by_status.get("resolved", 0),
        "open_incidents": total_incidents - by_status.get("resolved", 0),
        "critical_incidents": critical_open,
        "avg_resolution_days": avg_days,
        "demo_records": count(select(func.count(Report.id)).where(Report.is_demo.is_(True))),
    }


def categories(db: Session) -> list[dict]:
    rep = dict(db.execute(select(Report.category, func.count()).group_by(Report.category)).all())
    inc = dict(db.execute(select(Incident.category, func.count()).group_by(Incident.category)).all())
    out = [{"category": k, "label": v, "reports": rep.get(k, 0), "incidents": inc.get(k, 0)}
           for k, v in CATEGORIES.items() if rep.get(k) or inc.get(k)]
    return sorted(out, key=lambda x: x["reports"], reverse=True)


def _month_keys(n: int) -> list[str]:
    now = utcnow()
    y, m = now.year, now.month
    keys = []
    for _ in range(n):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def monthly(db: Session, months: int = 12) -> list[dict]:
    keys = _month_keys(months)
    start = datetime.strptime(keys[0] + "-01", "%Y-%m-%d")
    rep = Counter(d.strftime("%Y-%m") for d in db.scalars(select(Report.created_at).where(Report.created_at >= start)))
    res = Counter(d.strftime("%Y-%m") for d in db.scalars(
        select(Incident.resolved_at).where(Incident.resolved_at.is_not(None), Incident.resolved_at >= start)))
    return [{"month": k, "label": datetime.strptime(k, "%Y-%m").strftime("%b %Y"),
             "reports": rep.get(k, 0), "resolved_incidents": res.get(k, 0)} for k in keys]


def status_distribution(db: Session) -> dict:
    inc = dict(db.execute(select(Incident.status, func.count()).group_by(Incident.status)).all())
    ung = dict(db.execute(select(Report.status, func.count()).where(Report.incident_id.is_(None))
                          .group_by(Report.status)).all())
    return {
        "incidents": [{"status": k, "label": v, "count": inc.get(k, 0)} for k, v in STATUSES.items()],
        "ungrouped_reports": [{"status": k, "label": v, "count": ung.get(k, 0)} for k, v in STATUSES.items()],
    }


def priority_distribution(db: Session) -> list[dict]:
    rows = dict(db.execute(select(Incident.priority_level, func.count())
                           .where(Incident.status != "resolved").group_by(Incident.priority_level)).all())
    return [{"level": lv, "count": rows.get(lv, 0)} for lv in ("critical", "high", "moderate", "low")]
