$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "== Inside Code repository cleanup ==" -ForegroundColor Cyan

$pathsToRemove = @(
  'AUDIT_FIXES_V1_8_3.md',
  'BUILD_FIX_188.md',
  'BUILD_FIX_189.md',
  'CHANGELOG.md',
  'CLOUDFLARE_BUILD_FIX_V1_8_10.md',
  'CLOUDFLARE_WORKERS_DEPLOY.md',
  'DEPLOY_GITHUB_SUPABASE_CLOUDFLARE.md',
  'GITHUB_SUPABASE_DEPLOY.md',
  'INSIDE_CODE_V1_8_3_CHANGELOG.md',
  'MIGRATION_FIX_012.md',
  'MIGRATION_FIX_015.md',
  'README.txt',
  'RELEASE_V1_8_9.md',
  'RELEASE_V1_8_10.md',
  'RELEASE_V1_8_11.md',
  'RELEASE_V1_8_12.md',
  'SUPABASE_PRODUCTION.md',
  'CLEANUP_MANIFEST.txt',
  'TEMP_ENV_NOTICE.txt',
  'VERIFY-ALL.ps1',
  'VERIFY-ALL-FIXED.ps1',
  'docs',
  'supabase/README.md',
  'supabase/email-templates/README.md',
  'supabase/email-templates/_base-notes.txt',
  'web/node_modules',
  'web/dist',
  'node_modules'
)

foreach ($path in $pathsToRemove) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
    Write-Host "Removed: $path" -ForegroundColor Yellow
  }
}

# Keep the deployable browser-public env file.
if (-not (Test-Path 'web/.env')) {
  throw 'web/.env tidak ditemukan. Jangan lanjutkan cleanup karena file konfigurasi deploy hilang.'
}

Write-Host "`nGit status setelah cleanup:`n" -ForegroundColor Green
git status --short

$answer = Read-Host "Commit dan push cleanup ini ke GitHub sekarang? (y/n)"
if ($answer -match '^(y|yes)$') {
  git add -A
  git commit -m "chore: clean repository for production release"
  git push
  Write-Host "`nGitHub berhasil diperbarui." -ForegroundColor Green
} else {
  Write-Host "`nCleanup lokal selesai. Jalankan git add -A, commit, lalu git push saat siap." -ForegroundColor Cyan
}
