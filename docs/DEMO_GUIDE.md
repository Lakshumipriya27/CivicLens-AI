# CivicLens AI — Demo Guide for Judges

Time needed: **6–8 minutes**. Everything below works offline except the map tiles, which need internet.

## Before the demo

1. Reset the fictional data so the scenario is fresh. Inside `backend`, with the venv active:
   ```bash
   python -m app.seed --reset
   ```
2. Start the app (`start.bat`, or the backend and frontend commands from the README).
3. Open http://localhost:5173 in two browser windows (or one normal + one private window), so you can be logged in as
   a citizen in one and as the administrator in the other.
4. Have `docs\sample-images\demo_pothole_report3.jpg` ready to upload.
5. Decide on the AI mode. **Demo mode** (no key) shows a yellow *“Demo mode · simulated AI”* badge and every analysis
   says *Simulated*. With a Gemini key the badge reads *“Live AI · gemini-2.5-flash”*. Say which one you are showing.

## Talking points (1 minute)

**The real-world problem.** Citizens report potholes, overflowing bins, blocked drains and broken streetlights
through many channels. Five people reporting one pothole become five tickets, so the city counts complaints instead
of problems, and cannot tell what is most urgent.

**Why existing complaint portals fall short.** They are forms that store tickets: no understanding of the photo, no
link between related tickets, and no transparent reason for what gets fixed first.

**What makes CivicLens different.** It converts reports into *incidents*: photo understanding → duplicate suggestions
→ human-confirmed grouping → explainable priority → tracked resolution, all on one map.

## Scenario: three citizens report the same road damage

The seed data already contains two fictional citizens' reports of a pothole at the *Demo Public School* gate
(Asha, 5 days ago; Ravi, 3 days ago, 25 m away). You will submit the third report live.

### Step 1 — Citizen submits a photo (AI image analysis)
1. Log in as **Meera** (`meera@civiclens.demo` / `Citizen@1234`) → **Report an issue**.
2. Upload `demo_pothole_report3.jpg`, type the note *“Big pothole at the school entrance gate”*, click **Analyse photo**.
3. Show the result: detected category *Pothole / Road Damage*, suggested severity, the visible observation,
   safety concern and score.
   * *Live mode:* “Gemini looked at the photo and described only what is visible. The confidence is self-reported by the model.”
   * *Demo mode:* “This is explicitly simulated — it measures brightness, colour saturation and dark areas — so we never
     pretend an AI looked at it.”
4. Click **Use suggestions**. Point out that everything is editable — AI suggests, the citizen decides.

### Step 2 — Location
Click the map near the centre of the default view (the school pin area) or press **Use my current location**
(the browser asks for permission first; location is never read without it). Click **Check for similar reports**.

### Step 3 — Duplicate detection
Two possible matches appear (≈ 10–25 m away, same category, ~75–80 % match). Explain the five signals shown as bars:
proximity, category, text, time and image similarity. Stress: *“This is a suggestion, not proof. My report is still
recorded individually.”* Click **Submit report** → a report ID such as `CL-2611-XXXXXX` is shown.

### Step 4 — Administrator confirms the duplicates
1. In the other window log in as **admin** (`admin@civiclens.demo` / `Admin@1234`).
2. The dashboard shows a button **Review N duplicate suggestions**. Open **Duplicate review**.
3. Each card shows both photos side by side, the match score, distance and explanation.
4. Click **Confirm & group** on the Asha ↔ Ravi pair, then on Meera's pair. The remaining suggestion between reports
   that are now in the same incident is resolved automatically.

### Step 5 — Incident intelligence and priority
Open **Incidents** → the new pothole incident (3 linked reports). Show:
* all three photos, each citizen's own report kept separately;
* the **priority breakdown**: `P = 0.35·S + 0.25·R + 0.20·V + 0.20·W` with each factor's contribution — severity high
  (80), three reports → R = 50, exposure boosted by the words *school* and *children*, waiting time since the first report.
* Say clearly: *“This is our initial configurable heuristic, not an official government standard. Weights are in the config.”*
* Optional: **Analytics → Priority calculator** with S 80, R 70, V 90, W 50 gives **73.5 (High)**.

### Step 6 — Map
Open **City map**. The incident is a numbered marker (3 = linked reports), coloured by priority; ungrouped reports
are small category-coloured dots. Click it to show code, category, description, priority, number of reports and status.
Use the filters (category / status / priority).

### Step 7 — Resolution tracking
On the incident page, **Update status** → *In Progress* with a note, then → *Resolved* with a note and optionally an
evidence photo (any sample image). Every change is saved in the status history.

### Step 8 — The citizen sees the outcome
Back in Meera's window → **My reports** → open the report. Status is *Resolved*, the linked incident shows
*3 reports about this issue*, the resolution note/photo, and the full timeline. Internal admin notes are not visible.

### Step 9 — Analytics reflect the change
Admin **Dashboard / Analytics**: totals, status chart and monthly trend now include the new report and resolution —
all computed from the database, no hard-coded numbers.

## What is AI vs rule-based (for questions)

| Component | How it works |
|-----------|--------------|
| Image analysis | Gemini vision model with a strict JSON schema, validated server-side. Demo mode: Pillow image statistics + keywords, labelled simulated. |
| Duplicate detection | Weighted score: distance 0.35, category 0.30, text 0.15, time 0.10, image 0.10 (re-weighted when a photo hash is missing). Thresholds: 200 m, 30 days, score ≥ 0.55 — all configurable. |
| Image similarity | 64-bit difference hash (dHash) Hamming similarity |
| Grouping | Administrator decision only |
| Priority | Transparent weighted formula; exposure = category baseline + context keywords, overridable |

## Honest limitations
* The model can be wrong; confidence values are not calibrated.
* Perceptual hashing recognises near-identical photos, not the same pothole from a new angle.
* Exposure is estimated from words, not real traffic data.
* Notifications, rate limiting and production deployment are future work.

## Future improvements
Image embeddings (CLIP) for cross-angle matching, ward-level SLA tracking, SMS/WhatsApp intake, OSM road-class
exposure, citizen notifications, multilingual descriptions, and an offline-capable mobile PWA.
