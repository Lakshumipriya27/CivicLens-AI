@echo off
setlocal
title CivicLens AI - Backend (port 8000)
cd /d "%~dp0backend"

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python was not found. Install Python 3.10-3.13 and tick "Add python.exe to PATH".
  pause
  exit /b 1
)

if not exist "venv\Scripts\python.exe" (
  echo Creating Python virtual environment...
  python -m venv venv
  if errorlevel 1 (
    echo [ERROR] Could not create the virtual environment.
    pause
    exit /b 1
  )
)

if not exist "venv\.deps_installed" (
  echo Installing backend dependencies - first run only, this can take a few minutes...
  "venv\Scripts\python.exe" -m pip install --upgrade pip
  "venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 (
    echo [ERROR] Installing dependencies failed. See the messages above.
    pause
    exit /b 1
  )
  echo ok> "venv\.deps_installed"
)

if not exist ".env" (
  echo Creating backend\.env from .env.example - demonstration mode...
  copy ".env.example" ".env" >nul
)

echo.
echo Starting CivicLens AI backend on http://127.0.0.1:8000  (API docs: http://127.0.0.1:8000/docs)
echo Press Ctrl+C to stop.
echo.
"venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
