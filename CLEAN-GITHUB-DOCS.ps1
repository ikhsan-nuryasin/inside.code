$ErrorActionPreference = 'Stop'

# Hapus file dokumentasi/artefak lama dari branch Git saat ini.
# Perintah git rm akan membuat penghapusan ikut terkirim ke GitHub setelah commit + push.
$obsolete = @(
  'AUDIT_FIXES_V1_8_3.md',
  'BUILD_FIX_188.md',
  'BUILD_FIX_189.md',
  'CLEANUP_MANIFEST.txt',
  'CLOUDFLARE_BUILD_FIX_V1_8_10.md',
  'CLOUDFLARE_WORKERS_DEPLOY.md',
  'DEPLOY_GITHUB_SUPABASE_CLOUDFLARE.md',
  'GITHUB_SUPABASE_DEPLOY.md',
  'INSIDE_CODE_V1_8_3_CHANGELOG.md',
  'MIGRATION_FIX_012.md',
  'MIGRATION_FIX_015.md',
  'README.txt',
  'RELEASE_V1_8_10.md',
  'RELEASE_V1_8_11.md',
  'RELEASE_V1_8_12.md',
  'RELEASE_V1_8_9.md',
  'SUPABASE_PRODUCTION.md',
  'TEMP_ENV_NOTICE.txt',
  'VERIFY-ALL.ps1',
  'VERIFY-ALL-FIXED.ps1',
  'web/src/lib/demo.ts'
)

git rm --ignore-unmatch -- $obsolete
git add -A

git status --short

$answer = Read-Host 'Commit cleanup ini sekarang? (y/n)'
if ($answer -notmatch '^(y|Y)$') { exit 0 }

git commit -m 'chore: remove obsolete docs and demo mode artifacts'
git push origin main
