"""Transparent priority heuristic.

P = wS*S + wR*R + wV*V + wW*W   (default weights 0.35 / 0.25 / 0.20 / 0.20)

This is the platform's INITIAL, CONFIGURABLE prioritisation heuristic. It is not an officially
validated government standard. Every factor and its contribution is returned for explainability.
"""
import json
from datetime import datetime

from app.core.config import get_settings
from app.models import Incident, utcnow
from app.utils.constants import (CATEGORY_EXPOSURE, EXPOSURE_KEYWORDS, SEVERITY_SCORES, STATUS_RESOLVED,
                                 priority_level)

DISCLAIMER = ("Initial configurable prioritisation heuristic used by CivicLens AI. "
              "It is not an officially validated government standard.")


def clamp(v: float) -> float:
    return max(0.0, min(100.0, float(v)))


def compute(severity: float, reports: float, exposure: float, waiting: float,
            weights: dict[str, float] | None = None) -> dict:
    w = weights or get_settings().priority_weights
    factors = {
        "severity": clamp(severity),
        "reports": clamp(reports),
        "exposure": clamp(exposure),
        "waiting": clamp(waiting),
    }
    total_w = sum(w.values()) or 1.0
    contributions = {k: round(factors[k] * w[k] / total_w, 2) for k in factors}
    score = round(sum(contributions.values()), 1)
    return {
        "score": score,
        "level": priority_level(score),
        "weights": {k: round(v / total_w, 4) for k, v in w.items()},
        "factors": factors,
        "contributions": contributions,
        "formula": "P = {severity}·S + {reports}·R + {exposure}·V + {waiting}·W".format(
            **{k: round(v / total_w, 2) for k, v in w.items()}),
        "disclaimer": DISCLAIMER,
    }


def severity_score(severity: str) -> float:
    return SEVERITY_SCORES.get(severity, 55)


def corroboration_score(report_count: int) -> float:
    # One report = no corroboration; each additional independent report adds 25 points, capped at 100.
    return clamp(max(0, report_count - 1) * 25)


def exposure_score(category: str, texts: list[str]) -> tuple[float, list[str]]:
    base = CATEGORY_EXPOSURE.get(category, 40)
    joined = " ".join(texts).lower()
    matched = [k for k in EXPOSURE_KEYWORDS if k in joined]
    boost = sum(EXPOSURE_KEYWORDS[k] for k in matched)
    return clamp(base + boost), matched


def waiting_score(first_reported: datetime, until: datetime | None = None) -> tuple[float, float]:
    full_days = max(1, get_settings().PRIORITY_WAITING_FULL_DAYS)
    end = until or utcnow()
    days = max(0.0, (end - first_reported).total_seconds() / 86400)
    return clamp(days / full_days * 100), round(days, 1)


def score_incident(incident: Incident) -> dict:
    reports = list(incident.reports)
    n = len(reports)
    sev_rank = ["low", "medium", "high", "critical"]
    severity = max((r.severity for r in reports), key=lambda s: sev_rank.index(s) if s in sev_rank else 1,
                   default=incident.severity)
    S = severity_score(severity)
    R = corroboration_score(n)
    if incident.exposure_override is not None:
        V, matched = clamp(incident.exposure_override), []
        v_note = "Set manually by an administrator."
    else:
        V, matched = exposure_score(incident.category, [incident.description] + [r.description for r in reports])
        v_note = (f"Category baseline {CATEGORY_EXPOSURE.get(incident.category, 40)}"
                  + (f" + context keywords: {', '.join(matched)}" if matched else " (no context keywords found)"))
    first = min((r.created_at for r in reports), default=incident.created_at)
    until = incident.resolved_at if incident.status == STATUS_RESOLVED else None
    W, days = waiting_score(first, until)

    result = compute(S, R, V, W)
    result["explanations"] = {
        "severity": f"Highest severity among linked reports: {severity} → {S:.0f}.",
        "reports": f"{n} linked report(s): (n − 1) × 25, capped at 100 → {R:.0f}.",
        "exposure": f"{v_note} → {V:.0f}.",
        "waiting": (f"Waiting {days} day(s) since first report"
                    f"{' (frozen at resolution)' if until else ''}; reaches 100 after "
                    f"{get_settings().PRIORITY_WAITING_FULL_DAYS} days → {W:.0f}."),
    }
    result["computed_at"] = utcnow().isoformat()
    return result


def apply_to_incident(incident: Incident) -> dict:
    result = score_incident(incident)
    incident.priority_score = result["score"]
    incident.priority_level = result["level"]
    incident.priority_breakdown = json.dumps(result)
    incident.supporting_report_count = len(incident.reports)
    sev_rank = ["low", "medium", "high", "critical"]
    if incident.reports:
        incident.severity = max((r.severity for r in incident.reports),
                                key=lambda s: sev_rank.index(s) if s in sev_rank else 1)
    return result
