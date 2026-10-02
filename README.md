# Inside Code

Inside Code is a React/Vite PWA for mahasiswa with Supabase backend, Cloudflare Turnstile, Web Push, offline support, and admin-managed branding.

## Repository structure

```text
web/                    React + Vite frontend + Cloudflare Worker assets
supabase/migrations/    Database migrations 001–030
supabase/functions/     Edge Functions
.github/workflows/      Supabase CI/CD

docs/DEPLOYMENT.md      Deployment instructions
docs/SECURITY.md        Security notes
CHANGELOG.md            Release history
```

## Frontend local setup

Copy the environment template to `.env` when needed for local testing:

```powershell
cd web
npm install
npm run typecheck
npm run build
npm run dev
```

`web/.env` is local-only and ignored by Git. Never force-add it.

## Production deployment

Use the existing GitHub repository and the GitHub Actions workflow for Supabase. Cloudflare Workers Builds deploys the `web/` application from `main`.

See `docs/DEPLOYMENT.md`.
