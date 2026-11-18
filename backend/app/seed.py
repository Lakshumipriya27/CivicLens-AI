"""Seed clearly FICTIONAL demonstration data.

Usage (from the backend folder, with the virtual environment active):
    python -m app.seed            # seed only if the database is empty
    python -m app.seed --reset    # delete the database tables and re-seed
    python -m app.seed --images   # (re)generate sample upload photos in docs/sample-images
    python -m app.seed --create-admin you@example.org "Your Name"   # add an administrator (prompts for password)
"""
import argparse
import logging
from datetime import timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import BACKEND_DIR
from app.core.database import Base, SessionLocal, engine, init_db
from app.core.security import hash_password
from app.models import AIAnalysis, Report, StatusHistory, User, utcnow
from app.services import duplicate_service, incident_service, priority_service, storage_service
from app.services.ai.demo_provider import DemoProvider
from app.utils import demo_images
from app.utils.helpers import make_code

logger = logging.getLogger("civiclens.seed")

DEMO_PASSWORD_ADMIN = "Admin@1234"
DEMO_PASSWORD_CITIZEN = "Citizen@1234"

# Fictional demo area. Coordinates are a generic city grid used only for demonstration;
# every address is explicitly labelled as fictional.
BASE_LAT, BASE_LNG = 13.0418, 80.2341


def _off(north_m: float, east_m: float) -> tuple[float, float]:
    return BASE_LAT + north_m / 111_320, BASE_LNG + east_m / (111_320 * 0.974)


USERS = [
    ("Demo Administrator", "admin@civiclens.demo", "admin"),
    ("Asha (Demo Citizen)", "asha@civiclens.demo", "citizen"),
    ("Ravi (Demo Citizen)", "ravi@civiclens.demo", "citizen"),
    ("Meera (Demo Citizen)", "meera@civiclens.demo", "citizen"),
]

# key, user email, category, severity, description, (north_m, east_m), address, days_ago, image variant
REPORTS = [
    ("pot1", "asha", "pothole_road_damage", "high",
     "Deep pothole near the Demo Public School entrance gate. Two-wheelers swerve to avoid it.",
     (0, 0), "Fictional: School Lane, near Demo Public School gate", 5, 0),
    ("pot2", "ravi", "pothole_road_damage", "medium",
     "Large pothole close to the school entrance on School Lane, children walk around it.",
     (22, 12), "Fictional: School Lane, opposite Demo Public School", 3, 1),
    ("gar1", "meera", "garbage_overflow", "medium",
     "Garbage bin overflowing next to the vegetable market for several days.",
     (-420, 310), "Fictional: Market Road, Ward 12", 9, 0),
    ("gar2", "asha", "garbage_overflow", "medium",
     "Overflowing garbage bin at the market entrance, waste spilling onto the footpath.",
     (-405, 330), "Fictional: Market Road entrance, Ward 12", 7, 1),
    ("lit1", "ravi", "broken_streetlight", "medium",
     "Streetlight not working on the lane behind the bus depot; very dark at night.",
     (600, -380), "Fictional: Depot Back Lane", 13, 0),
    ("drn1", "asha", "blocked_drainage", "high",
     "Drain blocked with silt and plastic, water stagnates after rain.",
     (-250, -520), "Fictional: Canal Street, Ward 9", 41, 0),
    ("wat1", "meera", "water_leakage", "medium",
     "Water pipe leaking continuously at the corner near the community hall.",
     (330, 640), "Fictional: Hall Corner, Ward 14", 2, 0),
    ("pth1", "asha", "unsafe_pathway", "medium",
     "Broken footpath tiles near the bus stop, elderly residents have tripped.",
     (150, 820), "Fictional: Bus Stop 4, Main Road", 20, 0),
    ("drn0", "ravi", "blocked_drainage", "medium",
     "Drain cover missing and drain clogged near the playground.",
     (-900, 200), "Fictional: Playground Road", 96, 1),
    ("lit0", "meera", "broken_streetlight", "low",
     "Two streetlights flickering on Park Avenue.",
     (820, 150), "Fictional: Park Avenue", 64, 1),
]


def write_sample_images(target: Path) -> list[Path]:
    """Photos for the live demo (citizen 3 reporting the same pothole) and general testing."""
    target.mkdir(parents=True, exist_ok=True)
    files = {
        "demo_pothole_report3.jpg": demo_images.pothole(2),
        "demo_garbage.jpg": demo_images.garbage(3),
        "demo_streetlight.jpg": demo_images.streetlight(3),
        "demo_water_leak.jpg": demo_images.water_leak(3),
        "demo_drain.jpg": demo_images.drain(3),
        "demo_pathway.jpg": demo_images.pathway(3),
    }
    out = []
    for name, img in files.items():
        p = target / name
        img.save(p, format="JPEG", quality=88)
        out.append(p)
    return out


def seed(db: Session) -> bool:
    if db.scalar(select(func.count(User.id))):
        return False
    now = utcnow()
    users = {}
    for name, email, role in USERS:
        u = User(full_name=name, email=email, role=role, is_demo=True,
                 hashed_password=hash_password(DEMO_PASSWORD_ADMIN if role == "admin" else DEMO_PASSWORD_CITIZEN),
                 created_at=now - timedelta(days=120))
        db.add(u)
        users[email.split("@")[0]] = u
    db.flush()
    admin = users["admin"]

    provider = DemoProvider()
    reports = {}
    for key, who, cat, sev, desc, (n, e), addr, days, variant in sorted(REPORTS, key=lambda r: -r[7]):
        created = now - timedelta(days=days, hours=2)
        img = demo_images.GENERATORS[cat](variant)
        stored = storage_service.store_image(demo_images.jpeg_bytes(img), "demo")
        lat, lng = _off(n, e)
        user = users[who]
        r = Report(report_code=make_code("CL"), user_id=user.id, category=cat, description=desc,
                   image_path=stored.relative_path, image_hash=stored.image_hash, latitude=lat, longitude=lng,
                   address=addr, severity=sev, status="submitted", is_demo=True,
                   created_at=created, updated_at=created)
        db.add(r)
        db.flush()
        res = provider.analyze(stored.jpeg_bytes, desc)
        db.add(AIAnalysis(report_id=r.id, user_id=user.id, image_path=stored.relative_path,
                          image_hash=stored.image_hash, is_civic_issue=res.is_civic_issue,
                          detected_category=res.detected_category, visible_observation=res.visible_observation,
                          suggested_severity=res.possible_severity, confidence_score=res.confidence_score,
                          confidence_note=res.confidence_note, suggested_description=res.suggested_description,
                          safety_concern=res.safety_concern, provider=res.analysis_provider,
                          model_name=res.model_name, is_simulated=True, raw_response=res.raw_response,
                          created_at=created))
        db.add(StatusHistory(report_id=r.id, previous_status=None, new_status="submitted", changed_by=user.id,
                             note="Report submitted by citizen. (Fictional demo record)", created_at=created))
        db.flush()
        duplicate_service.generate_for_report(db, r)
        reports[key] = r

    def backdate_history(incident, when):
        for h in db.scalars(select(StatusHistory).where(StatusHistory.incident_id == incident.id,
                                                        StatusHistory.created_at > when)):
            h.created_at = when

    # Garbage: two reports confirmed as one incident, now in progress.
    gar = incident_service.create_incident(db, [reports["gar1"], reports["gar2"]], admin,
                                           note="Grouped after administrator review (fictional demo).")
    gar.created_at = now - timedelta(days=6)
    backdate_history(gar, now - timedelta(days=6))
    incident_service.change_status(db, gar, "acknowledged", admin, "Forwarded to sanitation team (demo).")
    incident_service.change_status(db, gar, "in_progress", admin, "Collection vehicle scheduled (demo).")

    # Streetlight: single verified report promoted to incident, acknowledged.
    lit = incident_service.create_incident(db, [reports["lit1"]], admin)
    lit.created_at = now - timedelta(days=11)
    incident_service.change_status(db, lit, "acknowledged", admin, "Electrical maintenance informed (demo).")

    # Resolved historical incidents (for status history, trends and resolution evidence).
    for key, ago_created, ago_resolved, note in [
        ("drn1", 39, 30, "Drain desilted and plastic waste removed (fictional demo)."),
        ("drn0", 94, 80, "Drain cover replaced and channel cleared (fictional demo)."),
        ("lit0", 62, 55, "Lamp units replaced (fictional demo)."),
    ]:
        inc = incident_service.create_incident(db, [reports[key]], admin)
        inc.created_at = now - timedelta(days=ago_created)
        incident_service.change_status(db, inc, "in_progress", admin, "Work order issued (demo).")
        evidence = storage_service.store_image(
            demo_images.jpeg_bytes(demo_images.GENERATORS[reports[key].category](7)), "evidence")
        incident_service.change_status(db, inc, "resolved", admin, note, evidence.relative_path)
        inc.resolved_at = now - timedelta(days=ago_resolved)
        backdate_history(inc, now - timedelta(days=ago_resolved))
        priority_service.apply_to_incident(inc)

    # Footpath report under review (not yet grouped).
    p = reports["pth1"]
    db.add(StatusHistory(report_id=p.id, previous_status="submitted", new_status="under_review",
                         changed_by=admin.id, note="Site inspection requested (demo)."))
    p.status = "under_review"

    for inc in (gar, lit):
        priority_service.apply_to_incident(inc)
    db.commit()
    logger.info("Seeded fictional demonstration data.")
    return True


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    ap = argparse.ArgumentParser(description="Seed CivicLens AI fictional demo data")
    ap.add_argument("--reset", action="store_true", help="Drop all tables and re-seed")
    ap.add_argument("--images", action="store_true", help="Write sample upload photos to docs/sample-images")
    ap.add_argument("--create-admin", nargs=2, metavar=("EMAIL", "FULL_NAME"), help="Create an administrator account")
    args = ap.parse_args()
    if args.create_admin:
        import getpass

        from app.schemas import RegisterIn
        email, name = args.create_admin
        pw = getpass.getpass("Password for the new administrator: ")
        body = RegisterIn(full_name=name, email=email, password=pw)  # same validation as registration
        init_db()
        with SessionLocal() as db:
            if db.scalar(select(User).where(func.lower(User.email) == body.email.lower())):
                print("A user with this email already exists.")
                return
            db.add(User(full_name=body.full_name, email=body.email.lower(), role="admin",
                        hashed_password=hash_password(body.password)))
            db.commit()
        print(f"Administrator {body.email} created.")
        return
    if args.images:
        for p in write_sample_images(BACKEND_DIR.parent / "docs" / "sample-images"):
            print("wrote", p)
        return
    if args.reset:
        from app import models  # noqa: F401
        Base.metadata.drop_all(bind=engine)
    init_db()
    with SessionLocal() as db:
        print("Seeded demo data." if seed(db) else "Database already has users; nothing seeded (use --reset).")


if __name__ == "__main__":
    main()
