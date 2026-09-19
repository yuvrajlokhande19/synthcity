@echo off
TITLE Project SynthCity C2 System Activator (2026 Standard)
COLOR 0A
CLS

echo ================================================================================
echo               PROJECT SYNTHCITY: AUTONOMOUS CIVIC INTELLIGENCE C2
echo ================================================================================
echo [1/3] Verifying Python dependencies...
py -m pip install -r requirements.txt >nul 2>&1 || python -m pip install -r requirements.txt >nul 2>&1

echo.
echo [2/3] Launching Standalone C2 Server and Telegram Bot Engine...
start "SynthCity C2 Backend Server" cmd /k "py backend.py || python backend.py"
start "SynthCity Telegram Bot Engine" cmd /k "py bot_engine.py || python bot_engine.py"

echo.
echo [3/3] Opening SynthCity Glassmorphism Command Dashboard in Web Browser...
timeout /t 2 >nul
start "" "index.html"

echo.
echo ================================================================================
echo  SYNTHCITY SYSTEM ACTIVATED SUCCESSFULLY!
echo  - Backend REST API: http://localhost:8000
echo  - Dashboard: index.html opened in default browser
echo ================================================================================
pause
