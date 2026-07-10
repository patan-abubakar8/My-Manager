@echo off
echo =====================================================
echo  My Manager - Full Stack App Launcher
echo =====================================================

REM ── Database credentials
set PGPASSWORD=Abu@king8
set DATABASE_URL=postgresql://postgres:Abu%%40king8@localhost:5432/mymanager

REM ── NVIDIA NIM API Key
set NVIDIA_NIM_API_KEY=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

echo [1/3] Ensuring database tables are up to date...
backend_py\.venv\Scripts\python.exe -c "import sys,os; os.environ['DATABASE_URL']=os.environ.get('DATABASE_URL'); sys.path.insert(0,'.'); from backend_py.src.infrastructure.database import create_tables; create_tables(); print('  DB ready!')"

echo [2/3] Starting Python FastAPI Backend on port 8080...
start "My Manager - FastAPI Backend" cmd /k "set DATABASE_URL=postgresql://postgres:Abu%%40king8@localhost:5432/mymanager&&set NVIDIA_NIM_API_KEY=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&&backend_py\.venv\Scripts\python.exe -m uvicorn backend_py.src.server:app --host 0.0.0.0 --port 8080 --reload"

timeout /t 3

echo [3/3] Starting React Frontend on port 5173...
start "My Manager - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo =====================================================
echo  All services started!
echo  Backend:  http://localhost:8080
echo  API Docs: http://localhost:8080/docs
echo  Frontend: http://localhost:5173
echo =====================================================
pause
