# CivicLens AI — Project Overview

**Category:** Artificial Intelligence · Smart City · Civic Technology
**Type:** Full-stack web application (React + FastAPI + SQLite)

## Problem

Cities receive reports about potholes, overflowing or illegally dumped garbage, blocked drains, water leaks,
damaged public infrastructure, broken streetlights and unsafe pathways through many channels. Several citizens often
report the *same* problem, so authorities see a pile of separate complaints rather than a list of real incidents.
It is hard to know how many problems actually exist, how severe they are, and which should be fixed first.

## Solution

CivicLens AI turns separate citizen reports into organised, AI-assisted **incident intelligence**:

1. **Image analysis** – a vision model (Google Gemini) suggests category, severity, a description of visible
   evidence and any visible safety concern. Citizens can edit the suggestion before submitting.
2. **Duplicate detection** – every new report is compared with nearby recent reports using five signals
   (distance, category, text, time, perceptual image hash). Likely matches become *suggestions*.
3. **Human-confirmed grouping** – an administrator confirms or rejects each suggestion. Confirmed reports are linked
   to one **incident**; every citizen keeps their own report record.
4. **Transparent priority** – each incident gets a 0–100 score from a configurable formula with a per-factor breakdown.
5. **Interactive map** – incidents (sized by linked reports, coloured by priority) and ungrouped reports on OpenStreetMap.
6. **Resolution tracking** – a full status lifecycle with notes and evidence photos, visible to every linked citizen.

## Users

| Role | Can do |
|------|--------|
| Citizen | Register, log in, submit reports with photos and map location, see AI suggestion and possible duplicates, track own reports and their incident's status/history/resolution evidence, view the public city map, edit profile |
| Administrator | Everything on the operations side: dashboard, search/filter all reports, view photos and AI analysis, review duplicate suggestions, create/merge incidents, link reports, update status with notes/evidence, internal notes, priority breakdown and exposure override, map, analytics |

## What is AI-powered vs rule-based

| Feature | Technique |
|---------|-----------|
| Category / severity / observation / safety concern | **AI** – Gemini vision model (live mode) · simple image statistics + keywords (demo mode, labelled *simulated*) |
| Duplicate detection | **Rule-based scoring** over geo distance, category similarity table, TF cosine text similarity, time decay, plus **dHash perceptual image similarity** |
| Grouping | **Human decision** (administrator) |
| Priority score | **Transparent heuristic** formula, configurable weights |
| Exposure factor | Category baseline + context keywords (rule-based), admin override |

## Architecture

```
Browser (React SPA, Vite dev server :5173)
   │  /api/*  (proxied)
   ▼
FastAPI (:8000) ── routes ── services ──┬── SQLAlchemy ── SQLite (civiclens.db)
                                        ├── storage (uploads/, re-encoded JPEG, EXIF stripped)
                                        └── AI provider interface ──┬── GeminiProvider (google-genai)
                                                                    └── DemoProvider (Pillow statistics)
```

* The AI provider is selected by `AI_PROVIDER` and implemented behind `VisionProvider` (`backend/app/services/ai/`).
  Adding another provider (e.g. a local ONNX model) only requires a new class and one line in the factory.
* AI responses are validated with Pydantic (`AnalysisResult`) before storage; invalid JSON or unknown categories
  are rejected or normalised.
* When live AI fails, the API returns an honest error (502/503) and the UI lets the citizen retry or continue manually.

## Security

* bcrypt password hashing; JWT (HS256) bearer tokens with expiry; secret from environment.
* Role-based authorisation on every protected endpoint (backend is the source of truth; frontend guards are UX only).
* Citizens can only read their own reports, photos and incident details; the public map omits photos and reporter identity.
* Uploads: MIME allow-list, size limit, Pillow verification, decompression-bomb guard, re-encoding (strips metadata
  including GPS), random UUID filenames, path-traversal-safe serving through an authenticated endpoint.
* Pydantic validation on all inputs, CORS allow-list, security headers, request logging, generic 500 messages.

## Limitations and future work

* Vision model confidence is self-reported, not calibrated. A labelled evaluation set would allow calibration.
* dHash only matches visually similar photos; a CLIP-style embedding would match the same object from other angles.
* Exposure uses keywords, not footfall/road-hierarchy data; could integrate OSM road classes and points of interest.
* No email/SMS notifications, rate limiting or Alembic migrations yet; SQLite is for local use.
* Map tiles come from the public OpenStreetMap tile server (fine for demos; use a tile provider for production).
