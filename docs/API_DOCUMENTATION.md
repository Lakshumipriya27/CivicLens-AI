# CivicLens AI — API Documentation

Base URL: `http://127.0.0.1:8000` · Interactive Swagger UI: **http://127.0.0.1:8000/docs** (always up to date).

Authentication: `Authorization: Bearer <access_token>` from `/api/auth/login` or `/api/auth/register`.
Roles: **C** = any logged-in user (citizen or admin), **A** = administrator only, **P** = public.
Errors return `{"detail": "<message>"}` with a meaningful status (400, 401, 403, 404, 409, 413, 415, 422, 502, 503).

## Authentication

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | P | `{full_name, email, password}` → `{access_token, user}`. Always creates a citizen. Password ≥ 8 chars with a letter and a digit. |
| POST | `/api/auth/login` | P | `{email, password}` → `{access_token, user}` |
| GET | `/api/auth/me` | C | Current user |
| PATCH | `/api/auth/me` | C | `{full_name}` |
| POST | `/api/auth/change-password` | C | `{current_password, new_password}` → 204 |

## AI analysis

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/ai/status` | P | Active provider, whether simulated, configuration message |
| POST | `/api/ai/analyze` | C | multipart: `image` (JPEG/PNG/WEBP ≤ 8 MB), optional `hint`. Stores the photo and analysis, returns the analysis with its `id`. |
| POST | `/api/ai/analyze/{report_id}` | A | Re-run analysis on an existing report's photo |

Analysis response fields: `id, detected_category, category_label, visible_observation, suggested_severity,
confidence_score, confidence_note, suggested_description, safety_concern, is_civic_issue, provider, model_name,
is_simulated, created_at, image_url`.
On provider failure: HTTP 502/503 with `{"detail": {"message": "...", "manual_entry_allowed": true}}`.

## Reports

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/reports` | C | multipart: `category, description, latitude, longitude, severity, address?` and **either** `analysis_id` (photo already analysed) **or** `image`. Returns report + `duplicate_suggestion_count`. |
| GET | `/api/reports` | C | Admin: all reports; citizen: own only. Filters: `category, severity, status, date_from, date_to, q, grouped, page, page_size` |
| GET | `/api/reports/my-reports` | C | Own reports (`status, page, page_size`) |
| GET | `/api/reports/{id}` | C | Owner or admin. Includes `analysis`, `incident`, `history`; admins also get `duplicate_suggestions` and `reporter`. Others get 404. |
| PATCH | `/api/reports/{id}` | C | Owner: `category, description, address` while *Submitted* and ungrouped. Admin: also `severity`, and `status` + `note` for ungrouped reports. |

## Duplicate detection

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/duplicates/check` | C | `{latitude, longitude, category, description, analysis_id?}` → `candidates[]` (limited public view: code, category, status, short description, distance, score, signals, explanation) |
| GET | `/api/duplicates` | A | List suggestions; `review_status=pending|confirmed|rejected|all` |
| GET | `/api/duplicates/{report_id}` | A | Suggestions involving a report |
| POST | `/api/duplicates/{suggestion_id}/review` | A | `{decision: "confirm"|"reject", note?}`. Confirm links both reports to one incident (creating it if needed). |

## Incidents

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/incidents` | A | Filters `category, status (or "open"), priority_level, q, date_from, date_to, sort=priority|newest|updated` |
| POST | `/api/incidents` | A | `{report_ids[], description?, category?, note?}` create incident from reports |
| GET | `/api/incidents/{id}` | C | Admin: full detail, all reports, notes. Citizen: only if one of their reports is linked; no internal notes. |
| PATCH | `/api/incidents/{id}` | A | `{description?, category?, address?, exposure_override?, clear_exposure_override?}` |
| POST | `/api/incidents/{id}/group` | A | `{report_ids[], note?}` link more reports (moves them from other incidents; empty incidents are merged away) |
| PATCH | `/api/incidents/{id}/status` | A | multipart: `new_status, note?, evidence?` (photo). Validated lifecycle; resolving needs a note or evidence. |
| POST | `/api/incidents/{id}/notes` | A | `{note}` internal note |

Lifecycle: `submitted → under_review → acknowledged → in_progress → resolved → reopened` (see `STATUS_TRANSITIONS`).

## Priority

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/priority/config` | C | Weights, severity scores, level bands, disclaimer |
| POST | `/api/priority/calculate` | C | `{severity, reports, exposure, waiting, weights?}` (each 0–100) → `{score, level, factors, weights, contributions, formula}` |
| GET | `/api/priority/{incident_id}` | A | Recalculate and return the incident's breakdown with explanations |

## Analytics, map, administration

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/analytics/overview` | A | Counts: reports, incidents, pending reviews, pending duplicates, in progress, resolved, critical, avg resolution days |
| GET | `/api/analytics/categories` | A | Reports and incidents per category |
| GET | `/api/analytics/monthly?months=12` | A | Reports submitted and incidents resolved per month |
| GET | `/api/analytics/status` | A | Incidents and ungrouped reports per status |
| GET | `/api/analytics/priority` | A | Open incidents per priority level |
| GET | `/api/map/incidents` | C | `{incidents[], reports[]}` (ungrouped). Filters `category, status|open, priority_level, include_reports` |
| GET | `/api/admin/dashboard` | A | Overview + recent reports + top incidents + chart data |
| GET | `/api/admin/reports` | A | Same filters as `/api/reports` |
| GET | `/api/admin/incidents` | A | Same filters as `/api/incidents` |
| POST | `/api/admin/incidents/{id}/notes` | A | Internal note |

## Files and health

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/files/{path}` | C | Uploaded photo; admins see all, citizens only their own photos and evidence for their incidents |
| GET | `/api/health` | P | Database status, AI provider status, environment |
| GET | `/api/meta` | P | Categories, statuses, severities, priority weights, duplicate thresholds |

## Example: full flow with curl (Git Bash / WSL)

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"meera@civiclens.demo","password":"Citizen@1234"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST http://127.0.0.1:8000/api/ai/analyze -H "Authorization: Bearer $TOKEN" \
  -F "image=@docs/sample-images/demo_pothole_report3.jpg;type=image/jpeg" -F "hint=pothole at school gate"
```
