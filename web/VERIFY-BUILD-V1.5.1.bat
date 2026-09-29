@echo off
setlocal
cd /d "%~dp0"
echo === Student Hub v1.5.1 build verification ===
echo.
npm install
if errorlevel 1 goto :fail
npm run verify:buildfix
if errorlevel 1 goto :fail
npm run typecheck
if errorlevel 1 goto :fail
npm run build
if errorlevel 1 goto :fail
echo.
echo BUILD VERIFICATION PASS
exit /b 0
:fail
echo.
echo BUILD VERIFICATION FAILED - lihat error di atas.
exit /b 1
