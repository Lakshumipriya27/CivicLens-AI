# CivicLens AI

**AI-assisted civic issue intelligence.** Citizens report public infrastructure problems with a photo and a
location. CivicLens AI analyses the photo, suggests which reports describe the same real-world problem, lets an
administrator group them into one incident, ranks incidents with a transparent priority score, and tracks each
incident to resolution on an interactive city map.

> AI output is always a *suggestion* that a human reviews. Nothing is merged automatically.

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, Vite 5, JavaScript, Tailwind CSS 3, React Router 6, Axios, Lucide, Recharts, Leaflet + React Leaflet, OpenStreetMap |
| Backend  | Python, FastAPI, Pydantic 2, SQLAlchemy 2, Uvicorn, Pillow, bcrypt, PyJWT |
| Database | SQLite (local), PostgreSQL-ready through SQLAlchemy |
| AI       | Google Gemini (`google-genai` SDK) **or** a clearly labelled demonstration mode that needs no API key |

---

## 1. Required software (Windows)

| Software | Version | Download |
|----------|---------|----------|
| Python | 3.10 – 3.13 (tested with 3.12) | https://www.python.org/downloads/ — tick **“Add python.exe to PATH”** during install |
| Node.js | 18 LTS or newer (tested with 18.19) | https://nodejs.org/ |
| Visual Studio Code | latest | https://code.visualstudio.com/ |

Check in a new terminal:

```bash
python --version
```

```bash
node --version
```

## 2. Extract the ZIP

Right-click `CivicLens-AI.zip` → **Extract All…** → choose a folder such as `C:\Projects`.
You should now have `C:\Projects\CivicLens-AI\` containing `backend`, `frontend`, `docs`, `README.md` and `start.bat`.

> Avoid folders inside OneDrive if you can; syncing `node_modules` is slow.

## 3. Open the project in VS Code

VS Code → **File → Open Folder…** → select the `CivicLens-AI` folder.
Open a terminal with **Terminal → New Terminal** (it opens PowerShell in the project folder).

## Quick start (one click)

Double-click **`start.bat`** in the project folder (or run `.\start.bat` in the VS Code terminal).
The first run creates the Python virtual environment, installs all dependencies, creates `backend\.env`,
and opens two windows — the backend and the frontend. Then open **http://localhost:5173**.

If you prefer to do it step by step (or `start.bat` fails), follow sections 4–10.

## 4. Create and activate the Python virtual environment

```bash
cd backend
```

```bash
python -m venv venv
```

Activate it (PowerShell):

```bash
.\venv\Scripts\Activate.ps1
```

If PowerShell says *running scripts is disabled*, run this once and try again:

```bash
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

(Command Prompt users: `venv\Scripts\activate.bat`.) Your prompt now starts with `(venv)`.

## 5. Install backend dependencies

```bash
pip install -r requirements.txt
```

## 6. Configure environment variables

```bash
copy .env.example .env
```

The defaults work as-is: demonstration AI mode, SQLite database, fictional demo data. Open `backend\.env` to change
settings (see section 13 for real AI).

## 7. Initialise the database

The database (`backend\civiclens.db`) and fictional demo data are created **automatically** the first time the
backend starts. To create or reset it manually:

```bash
python -m app.seed --reset
```

## 8. Start the backend

With the virtual environment active, inside `backend`:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Leave this terminal running. Check http://127.0.0.1:8000/api/health — it should show `"status":"ok"`.

## 9. Install frontend dependencies

Open a **second** terminal (the **+** button in the VS Code terminal panel):

```bash
cd frontend
```

```bash
npm install
```

## 10. Start the frontend

```bash
npm run dev
```

## 11. Access the application

| What | URL |
|------|-----|
| Web application | http://localhost:5173 |
| Backend API | http://127.0.0.1:8000 |
| Interactive API documentation (Swagger) | http://127.0.0.1:8000/docs |

The Vite dev server forwards every `/api/...` request to the backend, so the browser only talks to port 5173.

## 12. Demonstration accounts

All demo accounts and records are **fictional** and are clearly labelled in the UI.

| Role | Email | Password |
|------|-------|----------|
| Administrator | `admin@civiclens.demo` | `Admin@1234` |
| Citizen | `asha@civiclens.demo` | `Citizen@1234` |
| Citizen | `ravi@civiclens.demo` | `Citizen@1234` |
| Citizen | `meera@civiclens.demo` | `Citizen@1234` |

On the login page you can click a demo account to fill the form. You can also register a new citizen account.
Public registration always creates **citizen** accounts. To add your own administrator (for example with
`SEED_DEMO_DATA=false`), run inside `backend`: `python -m app.seed --create-admin you@example.org "Your Name"`.

The complete judge demonstration (three citizens reporting the same pothole) is in [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md).
Sample photos for uploading are in `docs\sample-images\`.

## 13. Enable real AI image analysis (Google Gemini)

1. Create a free API key at https://aistudio.google.com/apikey (Google account required).
2. Edit `backend\.env`:
   ```
   AI_PROVIDER=gemini
   GEMINI_API_KEY=paste-your-key-here
   GEMINI_MODEL=gemini-2.5-flash
   ```
3. Restart the backend (Ctrl+C, then run the uvicorn command again).
4. The top bar of the dashboard changes from **“Demo mode · simulated AI”** to **“Live AI · gemini-2.5-flash”**.

The key stays on the server; the frontend never sees it. If Gemini returns an error (invalid key, quota, network),
the citizen sees the real error message and can retry or continue with a manually chosen category — the platform
never silently substitutes a fake result.

## 14. Running the tests

```bash
cd backend
```

```bash
python -m pytest -q
```

The tests run the complete workflow (register → analyse → submit → duplicate detection → admin confirmation →
incident → priority → map → status updates → citizen view → analytics) against a temporary database.

## 15. Troubleshooting

| Problem | Fix |
|---------|-----|
| `python` is not recognised | Reinstall Python and tick “Add python.exe to PATH”, or use `py` instead of `python`. |
| `Activate.ps1 cannot be loaded because running scripts is disabled` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. |
| `pip install` fails building Pillow or bcrypt | Use Python 3.10–3.13 (wheels are pre-built). Upgrade pip: `python -m pip install --upgrade pip`. |
| Frontend shows “Cannot reach the CivicLens server” | The backend is not running on port 8000 — start it (section 8). |
| `Port 5173 is already in use` | Close the other Vite window, or end the `node` process in Task Manager. |
| `[Errno 10048] address already in use` on port 8000 | Another backend is running; close that window. |
| Map tiles are grey | The map needs internet access to load OpenStreetMap tiles. |
| Login fails for demo accounts | Demo data is seeded only into an empty database. Run `python -m app.seed --reset` (deletes all data). |
| “AI not configured” in the top bar | `AI_PROVIDER=gemini` without `GEMINI_API_KEY`. Add the key or set `AI_PROVIDER=demo`. |
| Logged out after restarting backend | Only happens if you change `SECRET_KEY`; log in again. |

## Project structure

```
CivicLens-AI/
├── backend/
│   ├── app/
│   │   ├── core/        config, database, security (bcrypt + JWT), auth dependencies
│   │   ├── models/      SQLAlchemy models (users, reports, incidents, AI analysis, duplicates, history, notes)
│   │   ├── schemas/     Pydantic request/response validation
│   │   ├── routes/      FastAPI routers (auth, reports, ai, duplicates, incidents, priority, analytics, map, admin, files, health)
│   │   ├── services/    ai/ (provider interface, Gemini, demo), duplicate, priority, incident, analytics, storage
│   │   ├── utils/       constants, geo/text/image helpers, synthetic demo images
│   │   ├── seed.py      fictional demonstration data
│   │   └── main.py      application entry point
│   ├── tests/           end-to-end API tests (pytest)
│   ├── uploads/         uploaded photos (created at runtime)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/  common UI, layout, map, reports, charts
│   │   ├── pages/       public, citizen, admin, shared
│   │   ├── services/    Axios client and API endpoints
│   │   ├── context/     auth and toast providers
│   │   ├── hooks/ utils/ styles/
│   │   ├── App.jsx      routes
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── docs/                PROJECT_OVERVIEW, API_DOCUMENTATION, DATABASE_DESIGN, TEST_CASES, DEMO_GUIDE, sample-images/
├── start.bat            one-click Windows start
├── start-backend.bat
└── start-frontend.bat
```

## Moving to PostgreSQL

Install a driver (`pip install "psycopg[binary]"`) and set
`DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/civiclens` in `backend\.env`. Tables are created on
start-up. (For production, add Alembic migrations.)
