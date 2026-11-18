# CivicLens AI — Test Cases

## Automated tests

`backend/tests/test_workflow.py` (run `python -m pytest -q` inside `backend`). Uses a temporary SQLite database,
the demo AI provider and the fictional seed data.

| ID | Test | Covers |
|----|------|--------|
| AT-01 | `test_health` | `/api/health` returns ok and reports simulated AI in demo mode |
| AT-02 | `test_priority_formula_example` | 80/70/90/50 → 73.5 (High); level boundaries |
| AT-03 | `test_auth_validation_and_protection` | 401 without token, 422 invalid registration, 401 wrong password |
| AT-04 | `test_full_workflow` | Register → login → admin endpoints forbidden (403) → rejects non-image (415) and corrupt image (400) → analyse (simulated, correct category) → own photo accessible → duplicate pre-check finds ≥ 2 → submit report → re-using analysis rejected → my-reports → other citizen gets 404 for report and photo → admin sees suggestions → confirm → second confirm → incident has 3 reports, R = 50, S = 80, exposure mentions *school* → map shows incident → invalid transition rejected (400) → in progress → resolve without note rejected → resolve with note + evidence → internal note → citizen sees *resolved*, history, evidence, no internal notes → analytics/dashboard counts |
| AT-05 | `test_promote_and_merge_incidents` | Create incident from a single report; link it into another incident; the empty incident is merged away (404) |
| AT-06 | `test_priority_endpoint` | `/api/priority/calculate` for citizens |

Last run during packaging: **6 passed**.

## Manual UI test checklist

| ID | Steps | Expected |
|----|-------|----------|
| UI-01 | Open `/`, `/how-it-works` on desktop and phone width | Layout adapts, no horizontal scroll, all links work |
| UI-02 | Register with a weak password | Inline validation message, no request sent |
| UI-03 | Register valid citizen | Redirect to citizen dashboard, empty state with *Report your first issue* |
| UI-04 | Visit `/admin/dashboard` as citizen | Redirected to citizen dashboard (backend also returns 403) |
| UI-05 | New report: choose a `.txt` file | Toast: only JPEG/PNG/WEBP |
| UI-06 | New report: upload sample photo → Analyse | Analysis card; demo mode shows *Simulated analysis* banner |
| UI-07 | With `AI_PROVIDER=gemini` and an invalid key → Analyse | Red notice with the real error, *Retry* and *Continue without AI* |
| UI-08 | Use my current location → deny permission | Message asking to click the map |
| UI-09 | Click map, drag pin | Coordinates update |
| UI-10 | Check similar reports near the demo school | Two candidates with distance, explanation, signal bars |
| UI-11 | Submit | Success screen with report code; appears in *My reports* |
| UI-12 | Admin → Duplicate review → Confirm & group | Toast with incident code; card disappears from *Pending*, appears in *Confirmed* |
| UI-13 | Admin → Duplicate review → Not the same | Suggestion moves to *Rejected*; reports stay separate |
| UI-14 | Admin → report detail → Create incident | New incident page opens with 1 linked report |
| UI-15 | Admin → incident → Link reports | Selected ungrouped reports are linked; count and priority update |
| UI-16 | Admin → incident → Edit → exposure override 90 | Priority recalculated, V explanation says “set manually” |
| UI-17 | Admin → incident → Update status to Resolved without note/photo | Error toast |
| UI-18 | Resolve with note + photo | Status badge *Resolved*, evidence in history |
| UI-19 | Citizen opens the linked report | Status *Resolved*, resolution note and evidence visible, no internal notes |
| UI-20 | Admin → All reports filters (category, severity, status, grouped, dates, search) | Table and count update; *Clear filters* resets |
| UI-21 | City map filters | Marker counts change; popup shows code, category, description, priority, linked reports, status |
| UI-22 | Analytics | Charts show data; priority calculator updates live |
| UI-23 | Profile → change name / password | Success toast; new password works on next login |
| UI-24 | Stop the backend, reload a page | Error state: *Cannot reach the CivicLens server…* with *Try again* |
| UI-25 | Fresh database with `SEED_DEMO_DATA=false`, admin created with `python -m app.seed --create-admin you@example.org "Your Name"` | Admin dashboard and charts show honest empty states |

## Security checks performed

* Passwords stored as bcrypt hashes (`users.hashed_password` begins with `$2b$`).
* Protected endpoints reject missing/invalid tokens (401) and wrong roles (403).
* Citizens cannot fetch other citizens' reports or photos (404).
* Upload validation: MIME allow-list, size limit, Pillow verification, re-encoding, random filenames.
* `GET /api/files/../../.env` style paths are rejected (resolved path must stay inside `uploads/`).
