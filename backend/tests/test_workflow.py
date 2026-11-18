"""End-to-end API workflow tests (run: `python -m pytest -q` from the backend folder).

Uses a temporary SQLite database and upload folder, demo AI provider and the fictional seed data.
"""
import io
import os
import tempfile

TMP = tempfile.mkdtemp(prefix="civiclens-test-")
os.environ.update({
    "DATABASE_URL": f"sqlite:///{TMP}/test.db",
    "UPLOAD_DIR": f"{TMP}/uploads",
    "AI_PROVIDER": "demo",
    "SEED_DEMO_DATA": "true",
    "SECRET_KEY": "test-secret-key-for-pytest-only-0123456789",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import BASE_LAT, BASE_LNG, DEMO_PASSWORD_ADMIN  # noqa: E402
from app.services import priority_service  # noqa: E402
from app.utils import demo_images  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["ai"]["is_simulated"] is True


def test_priority_formula_example():
    res = priority_service.compute(80, 70, 90, 50)
    assert res["score"] == 73.5 and res["level"] == "high"
    assert priority_service.compute(100, 100, 100, 100)["level"] == "critical"
    assert priority_service.compute(10, 0, 10, 0)["level"] == "low"


def test_auth_validation_and_protection(client):
    assert client.get("/api/auth/me").status_code == 401
    r = client.post("/api/auth/register", json={"full_name": "X", "email": "bad", "password": "short"})
    assert r.status_code == 422
    r = client.post("/api/auth/login", json={"email": "admin@civiclens.demo", "password": "wrong"})
    assert r.status_code == 401


def test_full_workflow(client):
    # 1-2. Citizen registers and logs in
    r = client.post("/api/auth/register", json={"full_name": "Test Citizen", "email": "test.citizen@example.com",
                                                "password": "Testing123"})
    assert r.status_code == 201, r.text
    assert r.json()["user"]["role"] == "citizen"
    cit = login(client, "test.citizen@example.com", "Testing123")
    assert client.get("/api/auth/me", headers=cit).json()["email"] == "test.citizen@example.com"

    # Citizen cannot access admin endpoints
    assert client.get("/api/admin/dashboard", headers=cit).status_code == 403

    # File validation
    r = client.post("/api/ai/analyze", headers=cit, files={"image": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 415
    r = client.post("/api/ai/analyze", headers=cit, files={"image": ("x.jpg", b"notanimage", "image/jpeg")})
    assert r.status_code == 400

    # 3-4. Upload image -> clearly labelled simulated analysis
    img = demo_images.jpeg_bytes(demo_images.pothole(2))
    r = client.post("/api/ai/analyze", headers=cit, files={"image": ("pothole.jpg", img, "image/jpeg")})
    assert r.status_code == 201, r.text
    analysis = r.json()
    assert analysis["is_simulated"] is True
    assert analysis["provider"] == "demo-heuristic"
    assert analysis["detected_category"] == "pothole_road_damage"

    # Citizen can fetch own uploaded photo
    assert client.get(analysis["image_url"], headers=cit).status_code == 200

    # Pre-submission duplicate check near the seeded school pothole
    lat, lng = BASE_LAT + 10 / 111320, BASE_LNG + 5 / 111320
    r = client.post("/api/duplicates/check", headers=cit, json={
        "latitude": lat, "longitude": lng, "category": "pothole_road_damage",
        "description": "Pothole at the school entrance", "analysis_id": analysis["id"]})
    assert r.status_code == 200
    assert len(r.json()["candidates"]) >= 2

    # 5-6. Submit report
    r = client.post("/api/reports", headers=cit, data={
        "category": "pothole_road_damage", "description": "Big pothole at the school entrance gate, dangerous.",
        "latitude": lat, "longitude": lng, "severity": "high", "address": "Test address",
        "analysis_id": analysis["id"]})
    assert r.status_code == 201, r.text
    report = r.json()
    assert report["report_code"].startswith("CL-")
    assert report["duplicate_suggestion_count"] >= 2

    # Reusing the analysis is rejected
    r = client.post("/api/reports", headers=cit, data={
        "category": "pothole_road_damage", "description": "Again", "latitude": lat, "longitude": lng,
        "analysis_id": analysis["id"]})
    assert r.status_code in (409, 422)

    mine = client.get("/api/reports/my-reports", headers=cit).json()
    assert mine["total"] == 1

    # Another citizen cannot read this report or its photo
    other = login(client, "asha@civiclens.demo", "Citizen@1234")
    assert client.get(f"/api/reports/{report['id']}", headers=other).status_code == 404
    assert client.get(report["image_url"], headers=other).status_code == 404

    # 7-8. Admin reviews duplicate suggestions
    adm = login(client, "admin@civiclens.demo", DEMO_PASSWORD_ADMIN)
    sugs = client.get(f"/api/duplicates/{report['id']}", headers=adm).json()
    assert len(sugs) >= 2
    first = sugs[0]
    r = client.post(f"/api/duplicates/{first['id']}/review", headers=adm, json={"decision": "confirm"})
    assert r.status_code == 200, r.text
    incident = r.json()["incident"]
    assert incident["supporting_report_count"] == 2

    # 9. Group remaining matching report into the same incident (via second suggestion)
    pending = [s for s in client.get(f"/api/duplicates/{report['id']}", headers=adm).json()
               if s["review_status"] == "pending"]
    for s in pending:
        r = client.post(f"/api/duplicates/{s['id']}/review", headers=adm, json={"decision": "confirm"})
        assert r.status_code == 200, r.text
        incident = r.json()["incident"]
    detail = client.get(f"/api/incidents/{incident['id']}", headers=adm).json()
    assert detail["supporting_report_count"] == 3
    # 10. Priority calculated with explanation
    pb = detail["priority_breakdown"]
    assert pb["factors"]["reports"] == 50 and pb["factors"]["severity"] == 80
    assert "school" in pb["explanations"]["exposure"]
    assert detail["priority_level"] in ("high", "critical", "moderate")

    # 11. Appears on map
    m = client.get("/api/map/incidents", headers=cit).json()
    assert any(i["id"] == incident["id"] for i in m["incidents"])

    # 12. Status updates and invalid transitions
    r = client.patch(f"/api/incidents/{incident['id']}/status", headers=adm, data={"new_status": "reopened"})
    assert r.status_code == 400
    r = client.patch(f"/api/incidents/{incident['id']}/status", headers=adm,
                     data={"new_status": "in_progress", "note": "Crew assigned"})
    assert r.status_code == 200, r.text
    r = client.patch(f"/api/incidents/{incident['id']}/status", headers=adm, data={"new_status": "resolved"})
    assert r.status_code == 400  # needs note or evidence
    ev = demo_images.jpeg_bytes(demo_images.pothole(9))
    r = client.patch(f"/api/incidents/{incident['id']}/status", headers=adm,
                     data={"new_status": "resolved", "note": "Patched with asphalt"},
                     files={"evidence": ("fixed.jpg", ev, "image/jpeg")})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "resolved"
    r = client.post(f"/api/admin/incidents/{incident['id']}/notes", headers=adm, json={"note": "Internal note"})
    assert r.status_code == 201

    # 13. Citizen sees updated status, history and evidence (but not internal notes)
    rep = client.get(f"/api/reports/{report['id']}", headers=cit).json()
    assert rep["status"] == "resolved"
    statuses = [h["new_status"] for h in rep["history"]]
    assert "submitted" in statuses and "resolved" in statuses
    assert rep["incident"]["resolution_image_url"]
    assert client.get(rep["incident"]["resolution_image_url"], headers=cit).status_code == 200
    inc_c = client.get(f"/api/incidents/{incident['id']}", headers=cit).json()
    assert "notes" not in inc_c

    # 14. Analytics reflect changes
    ov = client.get("/api/analytics/overview", headers=adm).json()
    assert ov["total_reports"] >= 11 and ov["resolved_incidents"] >= 4
    assert client.get("/api/analytics/categories", headers=adm).status_code == 200
    assert len(client.get("/api/analytics/monthly", headers=adm).json()) == 12
    assert client.get("/api/analytics/status", headers=adm).status_code == 200
    dash = client.get("/api/admin/dashboard", headers=adm).json()
    assert dash["overview"]["total_incidents"] >= 6


def test_promote_and_merge_incidents(client):
    adm = login(client, "admin@civiclens.demo", DEMO_PASSWORD_ADMIN)
    rows = client.get("/api/admin/reports", headers=adm, params={"grouped": "false"}).json()["rows"]
    assert rows
    r = client.post("/api/incidents", headers=adm, json={"report_ids": [rows[0]["id"]]})
    assert r.status_code == 201
    a = r.json()
    incs = client.get("/api/incidents", headers=adm, params={"status": "open"}).json()["rows"]
    other = next(i for i in incs if i["id"] != a["id"])
    other_detail = client.get(f"/api/incidents/{other['id']}", headers=adm).json()
    # Merge: moving the only report of `a` into `other` removes the empty incident
    r = client.post(f"/api/incidents/{other['id']}/group", headers=adm, json={"report_ids": [rows[0]["id"]]})
    assert r.status_code == 200
    assert r.json()["supporting_report_count"] == other_detail["supporting_report_count"] + 1
    assert client.get(f"/api/incidents/{a['id']}", headers=adm).status_code == 404


def test_priority_endpoint(client):
    cit = login(client, "ravi@civiclens.demo", "Citizen@1234")
    r = client.post("/api/priority/calculate", headers=cit,
                    json={"severity": 80, "reports": 70, "exposure": 90, "waiting": 50})
    assert r.json()["score"] == 73.5
