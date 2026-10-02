# Inside Code v1.8.9 — Deployment Guide

## 1. GitHub

Upload the contents of this package to the GitHub repository:

`https://github.com/ikhsan-nuryasin/inside.code`

Production branch: `main`

Do not upload `web/.env` or any secret/private key.

## 2. Cloudflare Workers Builds

Worker name:
`inside-code`

Build settings:

```text
Repository    : ikhsan-nuryasin/inside.code
Branch        : main
Root directory: web
Build command : npm install --no-audit --no-fund && npm run build
Deploy command: npx wrangler deploy
```

Add this Build Variable:

```text
SKIP_DEPENDENCY_INSTALL=true
```

Cloudflare documents `SKIP_DEPENDENCY_INSTALL` as the switch for disabling automatic dependency installation so a project can run its own install command. See:
https://developers.cloudflare.com/workers/ci-cd/builds/build-image/

### Frontend build variables

```text
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VITE_CAPTCHA_REQUIRED=true
VITE_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
```

These are build-time Vite variables. Do not put Supabase service-role keys, Turnstile Secret Key, VAPID private key, database password, or webhook secrets in `VITE_*` variables.

Turnstile must allow the exact deployment hostname, for example:
`inside-code.yasinikhhsan2.workers.dev`

## 3. Supabase GitHub Actions

Repository secrets required:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
```

Project ref is already fixed in the workflow:

```text
nxjwctumtkgcyghuzfwm
```

Workflow:

```text
GitHub main
  ↓
supabase db push
  ↓
001 → 031
  ↓
send-notification-push deploy
```

Use GitHub Actions `workflow_dispatch` when you need to run it manually.

## 4. Supabase push function secrets

Configure the required Edge Function secrets in Supabase; never commit them to GitHub.

Typical production variables used by the push function are documented in:

`supabase/functions/.env.example`

## 5. First system admin

After database deployment, create the first global admin by inserting the user's Supabase Auth UUID:

```sql
insert into public.system_admins (user_id)
values ('UUID_USER_KAMU')
on conflict (user_id) do nothing;
```

## 6. Local installation

```powershell
cd web
npm install
npm run typecheck
npm run build
npm run dev
```

Open the Vite URL shown in the terminal.
