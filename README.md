# Inside Code

Inside Code adalah PWA mobile-first untuk workspace kelas mahasiswa.

## Fitur utama

- Dashboard kelas
- Jadwal dan kalender
- Tugas + checklist + progress
- Materi dan file
- Forum kelas
- Kelompok dan pembagian ketua
- Kas kelas
- Dokumentasi/album
- Catatan pribadi dan catatan bersama
- Pengumuman dan notifikasi
- Web Push
- CAPTCHA/Turnstile
- MFA/TOTP
- Offline cache dan sinkronisasi saat online kembali
- Pengaturan branding aplikasi untuk system admin

## Stack

- React + TypeScript + Vite
- Supabase Auth + Postgres + Storage + Edge Functions
- Cloudflare Workers Assets
- IndexedDB untuk cache/queue/file offline

## Struktur

```text
web/                    Frontend PWA
supabase/migrations/    Database schema, RLS, function, trigger, policy
supabase/functions/     Edge Functions
supabase/email-templates/  Template email Auth
docs/                   Dokumentasi deployment dan security
.github/workflows/      Automation deployment Supabase
```

## Local development

Buat `web/.env` dari `web/.env.example`, isi nilai production/test milik proyek Supabase, lalu:

```powershell
cd web
npm install
npm run typecheck
npm run build
npm run dev
```

Aplikasi tidak memiliki Demo Mode. Environment Supabase harus tersedia agar aplikasi dapat melakukan autentikasi dan membaca data.

## Production deployment

Frontend memakai Cloudflare Workers/Assets. Database dan Edge Function memakai Supabase.

```text
Cloudflare Build root: web
Build command: npm install --include=dev --no-audit --no-fund && npm run build
Deploy command: npx wrangler deploy
```

Lihat:

- `docs/DEPLOYMENT.md`
- `docs/SECURITY.md`

## Supabase migrations

Migration terbaru pada source ini adalah `034_restore_rls_helper_exec_and_fix_app_admin.sql`.

Jangan mengubah migration yang sudah pernah diterapkan di project production. Untuk koreksi berikutnya, tambahkan migration baru secara berurutan.
