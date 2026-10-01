# Inside Code v1.8.3 — Audit & Fix Report

## Fixed
1. Production guard now reads `web/.env` and mode-specific env files, so local production checks no longer fail only because `.env` is ignored by the old script.
2. Turnstile uses one SPA-owned script loader, stable React lifecycle, visible loading/expired/error states, error-code hints, and retry.
3. Login error handling separates invalid credentials, rate limiting, CAPTCHA failures, unverified email, and generic service errors. CAPTCHA failures no longer count as wrong-password attempts.
4. Notification deep links are centralized and support camelCase + snake_case identifiers and explicit same-origin URLs.
5. Service Worker update event name is consistent across `main.tsx`, `AppShell`, and Settings.
6. Web Push `fail_count` is selected from the database and incremented correctly.
7. Push branding defaults to Inside Code and the new webhook header `x-inside-code-webhook-secret` is supported, while the old Student Hub header remains accepted for compatibility.
8. Branding settings get explicit table privileges, and Storage writes are limited to `branding/*` with PNG/JPG/WEBP only.
9. Logo replacement cleans up the previous branding object where possible; demo logos use a persistent data URL instead of a transient `blob:` URL in localStorage.
10. Primary-color overrides were centralized for high-impact controls using `--blue`.
11. Assignment reminder scheduling is added as an optional pg_cron job migration. The migration stays non-fatal when pg_cron is unavailable.
12. Product-facing version/branding references were updated to Inside Code v1.8.3. Legacy local-storage keys are still read and migrated so existing browser data is not lost.

## Intentionally unchanged
- Historical Supabase migration comments may still mention Student Hub; they describe migration history and are not runtime branding.
- PWA `manifest.webmanifest` remains a static file. Live web UI, login branding, title, theme color, favicon, and admin branding update dynamically. Making an installed PWA manifest fully database-driven requires a server-generated manifest endpoint and should be treated as a separate deployment feature.
- `package-lock.json` is not fabricated. Run `npm install` in the project folder and commit the generated lockfile to GitHub for deterministic CI installs.

## Validation completed
- ZIP archive integrity check: pass.
- TypeScript/TSX parser check: 43/43 files passed.
- Local import resolution: no missing relative source imports found.
- Production guard: pass with the included local `.env` (`Demo mode: false`, Supabase, VAPID public key and Turnstile configured).
- Node syntax checks for production guard and service worker: pass.

## Not fully executed in the audit container
`npm install` could not complete because the environment could not fetch the npm registry before timeout. Therefore a real `npm run typecheck`/`npm run build` was not claimed as verified here. Run those commands locally/CI before production release.
