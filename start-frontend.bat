@echo off
setlocal
title CivicLens AI - Frontend (port 5173)
cd /d "%~dp0frontend"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js / npm was not found. Install Node.js 18 LTS or newer from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing frontend dependencies - first run only...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. See the messages above.
    pause
    exit /b 1
  )
)

echo.
echo Starting CivicLens AI frontend on http://localhost:5173
echo Press Ctrl+C to stop.
echo.
call npm run dev
pause
