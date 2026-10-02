# Inside Code v1.8.9

Production-ready React/Vite PWA for the Inside Code student class platform.

This package is prepared for GitHub + Cloudflare Workers Builds + Supabase.

## Important

- The package does not contain `web/.env`; production values must be supplied in Cloudflare Build Environment Variables.
- Cloudflare dependency auto-install should be disabled with `SKIP_DEPENDENCY_INSTALL=true`, then the build command installs dependencies explicitly with `npm install` before `npm run build`.
- Supabase migrations are `001` through `031`.
- `supabase/functions/send-notification-push` is deployed by GitHub Actions after database migrations.
