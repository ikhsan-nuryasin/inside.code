# Inside Code v1.8.3

Production-ready React/Vite PWA for mahasiswa with Supabase, Cloudflare Turnstile, Web Push, offline cache, and application branding settings.

## Struktur
- `web/` — frontend Vite/React dan Cloudflare Worker asset configuration.
- `supabase/` — migrations dan Edge Function push notification.
- `DEPLOY_GITHUB_SUPABASE_CLOUDFLARE.md` — langkah deploy production.
- `INSIDE_CODE_V1_8_3_CHANGELOG.md` — perubahan dan bug fixes.

## Local
```powershell
cd web
npm install
npm run typecheck
npm run build
npm run dev
```

`web/.env` hanya untuk lokal dan diabaikan oleh Git. Untuk Cloudflare, masukkan semua `VITE_*` pada Build variables.
