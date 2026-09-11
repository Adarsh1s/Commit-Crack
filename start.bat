@echo off
REM Aqua Sentinel — Start Both Servers
REM Run this from the project root (frontend/) directory

echo ============================================================
echo   AQUA SENTINEL — Starting Servers
echo ============================================================
echo.

REM Start Backend in a new window
echo [1/2] Starting Backend (FastAPI on :8000)...
start "Aqua Sentinel Backend" cmd /k "cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start Frontend in a new window
echo [2/2] Starting Frontend (Vite on :5173)...
start "Aqua Sentinel Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================================
echo   Both servers are starting in separate windows.
echo   Backend:   http://localhost:8000
echo   Frontend:  http://localhost:5173
echo   API Docs:  http://localhost:8000/docs
echo ============================================================
echo.
pause
