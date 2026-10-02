# Inside Code v1.8.15

Aplikasi kelas mahasiswa berbasis React + Vite + Supabase + Cloudflare Workers.

## Prasyarat
- Node.js >= 20.19
- Project Supabase aktif
- Cloudflare account untuk deployment Worker/Pages

## Konfigurasi
File browser-public deployment sudah disediakan di `web/.env`.

Isi yang boleh berada di `web/.env` hanya nilai client/public dengan prefix `VITE_`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_CAPTCHA_REQUIRED`
- `VITE_TURNSTILE_SITE_KEY`

Jangan pernah menambahkan `service_role`, `sb_secret`, password database, VAPID private key, Turnstile secret, atau webhook secret ke file yang masuk frontend.

## Jalankan lokal
```bash
cd web
npm ci
npm run dev
```

## Build production
```bash
cd web
npm ci
npm run build
npm run preview
```

## Deploy Cloudflare
```bash
cd web
npm ci
npm run build
npx wrangler deploy
```

`web/wrangler.jsonc` sudah menunjuk ke `dist` dan menggunakan SPA fallback.

## Deploy Supabase
Migration berjalan berurutan dari folder `supabase/migrations/` melalui GitHub Actions.
Tambahkan secrets repository:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

Workflow akan melakukan `supabase db push` dan deploy Edge Function push notification.

## Struktur penting
- `web/src/` — frontend
- `web/public/` — aset publik dan service worker
- `supabase/migrations/` — database/RLS
- `supabase/functions/` — Edge Functions
- `.github/workflows/` — deployment automation
