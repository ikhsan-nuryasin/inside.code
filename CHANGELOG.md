# Inside Code Changelog

## 1.8.4

- Added database security hardening migration `030_security_hardening.sql`.
- Pinned missing TypeScript type dependency versions.
- Standardized repository line endings with `.gitattributes`.
- Removed historical repair notes and duplicated deployment documentation.
- Removed unused nested `web/public/icons/icon.svg` asset and its Service Worker precache entry.
- Consolidated deployment/security documentation under `docs/`.

## 1.8.3

- Inside Code branding and admin branding settings.
- Cloudflare Turnstile SPA handling and visible retry/error states.
- Login error classification improvements.
- Notification deep-link normalization.
- Web Push `fail_count` fix.
- Storage branding hardening and assignment reminder scheduler.
- Supabase migration repairs for migrations 012 and 015.
