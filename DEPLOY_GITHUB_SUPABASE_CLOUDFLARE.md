# Inside Code v1.8.3 — Deployment Runbook

## 1. GitHub existing repository
```powershell
git status
git branch backup-before-v1-8-3
git add .
git commit -m "fix: stabilize captcha branding notifications and scheduler"
git push origin main
```
Never force-add `web/.env`. The repository `.gitignore` excludes it.

## 2. Local test
```powershell
cd web
npm install
npm run typecheck
npm run build
```

## 3. Supabase
```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy send-notification-push
```
Edge Function secrets: `VAPID_PUBLIC_JWK`, `VAPID_PRIVATE_JWK`, `VAPID_SUBJECT`, `PUSH_APP_URL`, `PUSH_WEBHOOK_SECRET`.

For app branding, migrations `028` and `029` are required.

To add the first system admin, run in Supabase SQL Editor:
```sql
insert into public.system_admins(user_id)
select id from auth.users where email = 'EMAIL_ADMIN_KAMU'
on conflict (user_id) do nothing;
```

In Supabase Authentication → Bot and Abuse Protection, enable Cloudflare Turnstile with the same Site Key and the Cloudflare Secret Key. Do not put the secret in any `VITE_*` variable.

## 4. Cloudflare Workers Builds
Existing Worker: `inside-code`.
- Root directory: `web`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`

Build variables:
```text
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VITE_CAPTCHA_REQUIRED=true
VITE_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
```

## 5. Cloudflare Turnstile hostname
Allow:
```text
inside-code.yasinikhhsan2.workers.dev
```

## 6. Verify the deployed commit
After GitHub push, open Cloudflare → Deployments and verify the deployment commit SHA matches GitHub. Then open the site and hard-refresh with `Ctrl+F5`.

The login CAPTCHA must show a loading state, a widget, or an explicit error + retry button. It must never silently render an empty area.

## 7. Assignment reminder scheduler
Migration `029` tries to create a 15-minute pg_cron job when pg_cron is available. If the project does not expose pg_cron, enable it in Supabase and create the named schedule manually.
