# CivicLens AI — Database Design

SQLAlchemy 2 ORM models in `backend/app/models/__init__.py`. SQLite locally (foreign keys enforced with
`PRAGMA foreign_keys=ON`); switch to PostgreSQL by changing `DATABASE_URL`. Tables are created on start-up.
All timestamps are stored as naive UTC.

## Entity relationships

```
users 1───* reports *───0..1 incidents 1───* admin_notes
                │                 │
                │ 1               │ 1
                └──0..1 ai_analyses
reports 1───* duplicate_suggestions *───1 reports   (report_id, possible_duplicate_report_id)
status_history *──0..1 incidents, *──0..1 reports, *──0..1 users (changed_by)
```

## Tables

### users
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| full_name | VARCHAR(120) | required |
| email | VARCHAR(255) | **unique**, indexed, stored lower-case |
| hashed_password | VARCHAR(255) | bcrypt hash — plain passwords are never stored |
| role | VARCHAR(20) | CHECK `citizen` or `admin` |
| is_active | BOOLEAN | |
| is_demo | BOOLEAN | marks fictional seed accounts |
| created_at | DATETIME | |

### reports
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| report_code | VARCHAR(20) | **unique**, e.g. `CL-2611-1A2B3C` |
| user_id | FK → users.id | CASCADE, indexed |
| category | VARCHAR(40) | indexed; one of the 9 category keys |
| description | TEXT | |
| image_path | VARCHAR(255) | relative path inside `uploads/` |
| image_hash | VARCHAR(32) | 64-bit dHash (hex) for image similarity |
| latitude / longitude | FLOAT | CHECK valid ranges; composite index for proximity search |
| address | VARCHAR(255) | optional landmark |
| severity | VARCHAR(20) | low / medium / high / critical |
| status | VARCHAR(20) | indexed; mirrors the incident status once grouped |
| incident_id | FK → incidents.id | SET NULL, indexed |
| is_demo | BOOLEAN | fictional seed record |
| created_at / updated_at | DATETIME | created_at indexed |

### incidents
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| incident_code | VARCHAR(20) | **unique** `INC-…` |
| category, description, address | | |
| latitude / longitude | FLOAT | centroid of linked reports |
| severity | VARCHAR(20) | highest of linked reports |
| exposure_override | FLOAT NULL | admin override for factor V |
| priority_score | FLOAT | CHECK 0–100 |
| priority_level | VARCHAR(20) | indexed: low / moderate / high / critical |
| priority_breakdown | TEXT (JSON) | factors, weights, contributions, explanations |
| status | VARCHAR(20) | indexed |
| supporting_report_count | INTEGER | |
| resolution_note, resolution_image_path, resolved_at | | |
| is_demo, created_by (FK users SET NULL), created_at, updated_at | | |

### ai_analyses
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| report_id | FK → reports.id | **unique**, NULL until the report is submitted |
| user_id | FK → users.id | owner of the uploaded photo |
| image_path, image_hash | | |
| is_civic_issue | BOOLEAN | |
| detected_category, visible_observation, suggested_severity, suggested_description, safety_concern | | validated output |
| confidence_score | FLOAT NULL | 0–1 |
| confidence_note | VARCHAR | e.g. “self-reported by the model; not calibrated” |
| provider, model_name | | e.g. `google-gemini` / `gemini-2.5-flash`, or `demo-heuristic` |
| is_simulated | BOOLEAN | **true for demonstration-mode results** |
| raw_response | TEXT | raw provider JSON (for audit) |
| created_at | DATETIME | |

### duplicate_suggestions
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| report_id | FK → reports.id | the newer report |
| possible_duplicate_report_id | FK → reports.id | the earlier report |
| similarity_score | FLOAT | 0–1 weighted score |
| distance_m | FLOAT | |
| signals | TEXT (JSON) | per-signal values and weights |
| explanation | TEXT | human-readable reason |
| review_status | VARCHAR(20) | CHECK pending / confirmed / rejected, indexed |
| reviewed_by (FK users), reviewed_at, created_at | | |

Constraints: UNIQUE(report_id, possible_duplicate_report_id); CHECK report_id ≠ possible_duplicate_report_id.

### status_history
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| incident_id | FK → incidents.id NULL | incident-level change |
| report_id | FK → reports.id NULL | report-level event (submission, linking, ungrouped status change) |
| previous_status, new_status | VARCHAR(20) | |
| changed_by | FK → users.id | SET NULL |
| note | TEXT | visible to linked citizens |
| evidence_path | VARCHAR | resolution/progress photo |
| created_at | DATETIME | indexed |

### admin_notes
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| incident_id | FK → incidents.id | CASCADE |
| admin_id | FK → users.id | SET NULL (NULL = system note, e.g. merge) |
| note | TEXT | **internal only**, never returned to citizens |
| created_at | DATETIME | |

## Data minimisation

Only name, email and password hash are stored per user. Photos are re-encoded on upload, which removes EXIF metadata
(including GPS). Other citizens' identities and photos are never exposed in the citizen map or duplicate hints.
