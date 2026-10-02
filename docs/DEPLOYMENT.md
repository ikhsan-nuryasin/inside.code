# Inside Code v1.8.15 — Production Deployment

## 1. Cloudflare

Repository branch: `main`
Root directory: `web`

```text
SKIP_DEPENDENCY_INSTALL=true
Build command : npm install --include=dev --no-audit --no-fund && npm run build
Deploy command: npx wrangler deploy
```

Required build variables:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_VAPID_PUBLIC_KEY=<vapid-public-key>
VITE_CAPTCHA_REQUIRED=true
VITE_TURNSTILE_SITE_KEY=<turnstile-site-key>
```

Tidak ada `VITE_DEMO_MODE`. Aplikasi selalu berjalan terhadap Supabase.

Jangan masukkan secret server ke `VITE_*`.

## 2. Supabase Auth

Atur Site URL dan Redirect URLs sesuai domain Cloudflare yang benar.

Untuk signup dan resend confirmation, frontend menggunakan:

```text
emailRedirectTo = window.location.origin
```

Template email harus memakai `{{ .ConfirmationURL }}` dan tidak boleh meng-hard-code URL localhost.

Aktifkan Confirm Email untuk production.

## 3. GitHub Actions

Set repository secrets:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
```

Workflow:

```text
.github/workflows/supabase-deploy.yml
```

Workflow menjalankan migration Supabase dan deploy Edge Function `send-notification-push`.

## 4. Local verification

```powershell
cd web
npm install
npm run typecheck
npm run build
npm run dev
```

Build production guard memeriksa URL Supabase, publishable key, VAPID public key, dan Turnstile site key.

## 5. Web Push

Pastikan:

```text
VITE_VAPID_PUBLIC_KEY
```

tersedia di browser build.

VAPID private key dan webhook secret hanya disimpan sebagai Supabase Edge Function Secrets.

Database/Webhook untuk trigger push harus dikonfigurasi di project Supabase yang aktif.

## 6. Service worker

Cache namespace saat ini:

```text
inside-code-v1.8.15-security-push
```

Setiap release baru harus menaikkan namespace agar bundle lama tidak menetap.

## 7. Migration rule

Jangan mengedit migration yang sudah diterapkan di production.

Source ini sudah memiliki migration hingga:

```text
034_restore_rls_helper_exec_and_fix_app_admin.sql
```

Koreksi database berikutnya harus dibuat sebagai migration `035`, `036`, dan seterusnya.
