"""Shared domain constants: categories, severities, statuses, roles."""

ROLE_CITIZEN = "citizen"
ROLE_ADMIN = "admin"

CATEGORIES: dict[str, str] = {
    "pothole_road_damage": "Pothole / Road Damage",
    "garbage_overflow": "Overflowing Garbage Bin",
    "illegal_dumping": "Illegal Garbage Dumping",
    "blocked_drainage": "Blocked Drainage",
    "water_leakage": "Water Leakage",
    "damaged_infrastructure": "Damaged Public Infrastructure",
    "broken_streetlight": "Broken Streetlight",
    "unsafe_pathway": "Unsafe Public Pathway",
    "other": "Other / Unclear",
}

# Partial similarity between related categories (symmetric). Same category = 1.0.
RELATED_CATEGORIES: dict[frozenset, float] = {
    frozenset({"garbage_overflow", "illegal_dumping"}): 0.6,
    frozenset({"pothole_road_damage", "unsafe_pathway"}): 0.5,
    frozenset({"blocked_drainage", "water_leakage"}): 0.5,
    frozenset({"damaged_infrastructure", "unsafe_pathway"}): 0.4,
    frozenset({"damaged_infrastructure", "broken_streetlight"}): 0.3,
    frozenset({"pothole_road_damage", "damaged_infrastructure"}): 0.3,
}

SEVERITIES = ["low", "medium", "high", "critical"]
SEVERITY_SCORES = {"low": 25, "medium": 55, "high": 80, "critical": 95}

# Baseline public-exposure score by category (0-100). Initial heuristic values, configurable in code.
CATEGORY_EXPOSURE = {
    "pothole_road_damage": 60,
    "garbage_overflow": 50,
    "illegal_dumping": 45,
    "blocked_drainage": 55,
    "water_leakage": 45,
    "damaged_infrastructure": 55,
    "broken_streetlight": 60,
    "unsafe_pathway": 70,
    "other": 40,
}

# Keywords in report descriptions that indicate higher public exposure / vulnerable users.
EXPOSURE_KEYWORDS = {
    "school": 15, "hospital": 15, "children": 12, "elderly": 10,
    "bus stop": 10, "junction": 8, "main road": 10, "highway": 10, "market": 8,
    "crossing": 8, "night": 6, "busy": 6, "pedestrian": 6, "wheelchair": 10,
}

STATUS_SUBMITTED = "submitted"
STATUS_UNDER_REVIEW = "under_review"
STATUS_ACKNOWLEDGED = "acknowledged"
STATUS_IN_PROGRESS = "in_progress"
STATUS_RESOLVED = "resolved"
STATUS_REOPENED = "reopened"

STATUSES: dict[str, str] = {
    STATUS_SUBMITTED: "Submitted",
    STATUS_UNDER_REVIEW: "Under Review",
    STATUS_ACKNOWLEDGED: "Acknowledged",
    STATUS_IN_PROGRESS: "In Progress",
    STATUS_RESOLVED: "Resolved",
    STATUS_REOPENED: "Reopened",
}

OPEN_STATUSES = {STATUS_SUBMITTED, STATUS_UNDER_REVIEW, STATUS_ACKNOWLEDGED,
                 STATUS_IN_PROGRESS, STATUS_REOPENED}

# Allowed lifecycle transitions
STATUS_TRANSITIONS: dict[str, set[str]] = {
    STATUS_SUBMITTED: {STATUS_UNDER_REVIEW, STATUS_ACKNOWLEDGED, STATUS_IN_PROGRESS, STATUS_RESOLVED},
    STATUS_UNDER_REVIEW: {STATUS_ACKNOWLEDGED, STATUS_IN_PROGRESS, STATUS_RESOLVED},
    STATUS_ACKNOWLEDGED: {STATUS_UNDER_REVIEW, STATUS_IN_PROGRESS, STATUS_RESOLVED},
    STATUS_IN_PROGRESS: {STATUS_ACKNOWLEDGED, STATUS_RESOLVED},
    STATUS_RESOLVED: {STATUS_REOPENED},
    STATUS_REOPENED: {STATUS_UNDER_REVIEW, STATUS_ACKNOWLEDGED, STATUS_IN_PROGRESS, STATUS_RESOLVED},
}

DUP_PENDING = "pending"
DUP_CONFIRMED = "confirmed"
DUP_REJECTED = "rejected"

PRIORITY_LEVELS = [(75, "critical"), (50, "high"), (30, "moderate"), (0, "low")]


def priority_level(score: float) -> str:
    for threshold, level in PRIORITY_LEVELS:
        if score >= threshold:
            return level
    return "low"


def category_similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0
    return RELATED_CATEGORIES.get(frozenset({a, b}), 0.0)
