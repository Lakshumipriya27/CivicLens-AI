@echo off
REM CivicLens AI - starts the backend and the frontend in two separate windows.
REM First run installs everything automatically (Python venv + npm packages).
cd /d "%~dp0"
echo Starting CivicLens AI...
start "CivicLens AI - Backend" cmd /k ""%~dp0start-backend.bat""
REM Give the backend a head start so the database and demo data exist before the UI loads.
timeout /t 5 /nobreak >nul
start "CivicLens AI - Frontend" cmd /k ""%~dp0start-frontend.bat""
echo.
echo Two windows were opened. When both are ready, open:  http://localhost:5173
echo The first run can take several minutes while dependencies install.
echo.
pause
