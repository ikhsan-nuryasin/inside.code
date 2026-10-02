# Inside Code Changelog

## 1.8.9
- Production packaging cleanup.
- Removed local `web/.env` from the release package.
- Updated Service Worker cache namespace to v1.8.9.
- Updated Supabase deployment documentation/workflow to cover migrations 001–031.
- Added production environment template for Cloudflare.
- Cloudflare build instructions now support disabling automatic dependency installation to avoid stale `npm ci` lockfile mismatch.

## 1.8.8
- Fixed Cloudflare build dependency range configuration for React type packages.

## 1.8.7
- Fixed registration/login to use actual submitted form values, including browser/password-manager autofill values.
- Password checklist is advisory; Supabase Auth remains authoritative for password policy.

## 1.8.5
- Fixed the stray `0` on auth when the login lock is inactive.
- Added live registration password requirement indicators.
- Normalized legacy `Student Hub` database branding to `Inside Code` without overwriting custom branding.
