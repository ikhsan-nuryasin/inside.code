# Student Hub PWA v1.8.1

Security hardening release: Cloudflare Turnstile, auth abuse guard, TOTP MFA, email verification guidance, secure headers, production guards, and Web Push.

# Student Hub — Hosting Ready

Student Hub is a React + Vite + Supabase PWA for university class coordination. Production release: v1.8.1 randomizer + monthly cash refinement with v1.8.0 security hardening.

## Architecture

- Frontend: React 19 + TypeScript + Vite 8
- Backend: Supabase Auth + Postgres + RLS + Storage + Realtime
- Offline: IndexedDB cache + sync outbox
- Hosting: static hosting for `web/dist` (Vercel, Netlify, Cloudflare Pages, or cPanel/shared hosting)

## Important product rules

- No attendance/presence module.
- No lecturer account/module.
- No self-service class creation.
- No self-service class joining.
- Classes and memberships are provisioned by an operator/database administrator.

## Local development

```powershell
cd web
copy .env.example .env.local
npm install
npm run typecheck
npm run build
npm run dev
```

Demo mode:

```env
VITE_DEMO_MODE=true
```

Real Supabase:

```env
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Never place a Supabase secret/service-role key in frontend environment variables.

## Production deployment

1. Create/configure the Supabase project.
2. Run `supabase/migrations/*.sql` in numeric order from 001 through 020.
3. Configure Storage and RLS through those migrations.
4. Provision users/classes/memberships with the operator workflow.
5. Run `npm install`, `npm run typecheck`, and `npm run build` in `web`.
6. Deploy the contents of `web/dist` to your static host.
7. Set production environment variables at build time on Vercel/Netlify/Cloudflare, or build locally and upload `dist` to shared hosting.
8. Test login, RLS isolation, Storage access, PWA install/update, and offline queue before release.

See `DEPLOYMENT.md` for step-by-step hosting instructions.

## System Push Notifications

v1.6.0 adds optional Web Push outside the open app. Configure VAPID + Supabase Edge Function + a `notifications` INSERT Database Webhook, then enable notifications from **Pengaturan** in the installed/HTTPS PWA.


Production security and deployment: see `DEPLOYMENT.md`, `SUPABASE_PRODUCTION.md`, and `docs/41_V1.8.0_SECURITY_HARDENING.md`. Migrations are `001–027` and must be applied in order.
