# Inside Code v1.8.9 — Production Ready Package

This package is prepared from the v1.8.8 production source with release-only cleanup and deployment fixes:

- Removes local `web/.env` from the distributable package.
- Adds a lockfile generated from `web/package.json` so Cloudflare can use `npm ci` deterministically.
- Bumps the Service Worker cache namespace to `inside-code-v1.8.9-security-push`.
- Updates the Supabase deployment workflow to verify migration 031 and report migrations 001–031.
- Adds `web/.env.production.example` for Cloudflare build-variable configuration.
- Keeps production authentication delegated to Supabase Auth; password checklist is advisory only.
