@echo off
setlocal
cd /d "%~dp0"
if not exist .env.local copy /Y .env.example .env.local >nul
powershell -NoProfile -Command "(Get-Content .env.local) -replace '^VITE_DEMO_MODE=.*','VITE_DEMO_MODE=true' | Set-Content .env.local"
if not exist node_modules (
  echo [Student Hub] Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)
echo.
echo [Student Hub] Starting demo mode...
call npm run dev
