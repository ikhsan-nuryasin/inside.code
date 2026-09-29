# Student Hub — Cloudflare Workers Deployment

Repository: `ikhsan-nuryasin/inside.code`
Frontend root: `web/`

## Workers Builds
- Production branch: `main`
- Root directory: `web`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

## Required production build variables
Set these under Workers → Settings → Builds → Variables and secrets for Production:
```text
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VITE_CAPTCHA_REQUIRED=true
VITE_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
```

Only public/client values belong in `VITE_*`. Keep these server-side / in Supabase secrets:
- `SUPABASE_SERVICE_ROLE_KEY`
- `TURNSTILE_SECRET_KEY`
- `VAPID_PRIVATE_JWK`
- `PUSH_WEBHOOK_SECRET`
- database passwords

## Local verification
```powershell
cd web
npm install
$env:VITE_DEMO_MODE="false"
$env:VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_test"
$env:VITE_VAPID_PUBLIC_KEY="YOUR_TEST_PUBLIC_VAPID_KEY"
$env:VITE_CAPTCHA_REQUIRED="true"
$env:VITE_TURNSTILE_SITE_KEY="YOUR_TEST_TURNSTILE_SITE_KEY"
npm run typecheck
npm run build
```

Successful build output: `web/dist/`.

`web/wrangler.jsonc` publishes `dist/` and enables SPA fallback for React routes.
