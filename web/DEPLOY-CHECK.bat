@echo off
setlocal
cd /d "%~dp0"
echo ===============================================
echo Student Hub v1.5.5 - Production Check
echo ===============================================
if not exist package.json (
  echo ERROR: package.json not found.
  exit /b 1
)
call npm install
if errorlevel 1 exit /b 1
call npm run typecheck
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
call npm run verify:dist
if errorlevel 1 exit /b 1
echo.
echo READY: upload the contents of dist
echo to your static HTTPS host.
endlocal
