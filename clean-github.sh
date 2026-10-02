#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

paths=(
  AUDIT_FIXES_V1_8_3.md BUILD_FIX_188.md BUILD_FIX_189.md CHANGELOG.md
  CLOUDFLARE_BUILD_FIX_V1_8_10.md CLOUDFLARE_WORKERS_DEPLOY.md
  DEPLOY_GITHUB_SUPABASE_CLOUDFLARE.md GITHUB_SUPABASE_DEPLOY.md
  INSIDE_CODE_V1_8_3_CHANGELOG.md MIGRATION_FIX_012.md MIGRATION_FIX_015.md
  README.txt RELEASE_V1_8_9.md RELEASE_V1_8_10.md RELEASE_V1_8_11.md RELEASE_V1_8_12.md
  SUPABASE_PRODUCTION.md CLEANUP_MANIFEST.txt TEMP_ENV_NOTICE.txt
  VERIFY-ALL.ps1 VERIFY-ALL-FIXED.ps1 docs supabase/README.md
  supabase/email-templates/README.md supabase/email-templates/_base-notes.txt
  web/node_modules web/dist node_modules
)
for p in "${paths[@]}"; do
  if [[ -e "$p" ]]; then
    rm -rf -- "$p"
    echo "Removed: $p"
  fi
done
[[ -f web/.env ]] || { echo 'ERROR: web/.env tidak ditemukan.' >&2; exit 1; }

git status --short
printf '
Commit/push sekarang? (y/N) '
read -r answer
if [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]; then
  git add -A
  git commit -m "chore: clean repository for production release"
  git push
fi
