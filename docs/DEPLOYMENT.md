# Inside Code — Deployment

## GitHub → Supabase

Repository yang digunakan: `https://github.com/ikhsan-nuryasin/inside.code`

GitHub Actions membutuhkan dua repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

Project ref sudah ditetapkan di workflow:

```text
nxjwctumtkgcyghuzfwm
```

Workflow:

```text
GitHub main
  ↓
Supabase CLI
  ↓
supabase db push
  ↓
001 → 030
  ↓
send-notification-push
```

Jangan simpan database password, access token, Turnstile Secret Key, VAPID private key, atau webhook secret di frontend.

## Cloudflare Workers

- Worker: `inside-code`
- Branch: `main`
- Root directory: `web`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Build variables frontend:

```text
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VITE_CAPTCHA_REQUIRED=true
VITE_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
```

`VITE_*` harus tersedia pada saat Vite melakukan build.

Turnstile harus mengizinkan hostname deployment, misalnya:

```text
inside-code.yasinikhhsan2.workers.dev
```

## Local

```powershell
cd web
npm install
npm run typecheck
npm run build
npm run dev
```

`web/.env` hanya untuk lokal dan tetap diabaikan Git.

## First system admin

Setelah database selesai dideploy, operator dapat memberikan akses global kepada user tertentu melalui SQL Editor:

```sql
insert into public.system_admins (user_id)
values ('UUID_USER_KAMU')
on conflict (user_id) do nothing;
```
