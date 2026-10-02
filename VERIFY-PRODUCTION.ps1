$ErrorActionPreference = 'Stop'

Write-Host '=== Inside Code production verification ===' -ForegroundColor Cyan

if (Get-ChildItem -Path web -Recurse -File | Select-String -Pattern 'VITE_DEMO_MODE|DEMO_MODE|build:demo' -Quiet) {
  throw 'Demo Mode reference masih ditemukan di web/.'
}

if (Test-Path 'web/.env') { throw 'web/.env tidak boleh masuk source package.' }
if (Test-Path 'web/.env.local') { Write-Warning 'web/.env.local ditemukan; pastikan file ini tidak di-commit.' }
if (Test-Path 'web/node_modules') { Write-Host 'web/node_modules terdeteksi (normal untuk local development).' -ForegroundColor DarkGray }

Push-Location web
npm run typecheck
Pop-Location

Write-Host 'VERIFY PASS' -ForegroundColor Green
