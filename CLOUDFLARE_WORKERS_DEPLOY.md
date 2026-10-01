# Inside Code v1.8.3 — Cloudflare Workers Deployment

Repository yang sudah ada tetap digunakan. Tidak perlu membuat repository baru.

## 1. Workers Builds

- Production branch: `main`
- Root directory: `web`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

## 2. PENTING: Build variables

Untuk aplikasi Vite, semua `VITE_*` harus tersedia pada saat build. Masukkan di:

`Workers & Pages → inside-code → Settings → Builds → Variables and secrets → Production`

```text
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VITE_CAPTCHA_REQUIRED=true
VITE_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
```

Variable yang hanya ada pada runtime tidak otomatis masuk ke bundle Vite yang sudah dibangun.

## 3. Turnstile

Widget harus mengizinkan hostname deployment, misalnya:

```text
inside-code.yasinikhhsan2.workers.dev
```

Hostname tidak memakai `https://` dan tidak memakai path `/login`.

Site key boleh ada di browser. Secret key hanya untuk validasi server/Supabase dan tidak boleh diberi awalan `VITE_`.

## 4. Setelah mengubah variables

Lakukan:

`Workers & Pages → inside-code → Deployments → Retry deployment`

Lalu buka website dengan `Ctrl + F5`.

Halaman login v1.8.3 akan menampilkan panel Turnstile secara jelas. Jika script/widget gagal, halaman akan menampilkan pesan error dan tombol `Coba muat ulang CAPTCHA`, bukan area kosong.

## 5. Supabase

Jalankan migration hingga `029_inside_code_security_and_scheduler_fixes.sql`.

Migration 028–029 membuat:

- `app_settings`
- `system_admins`
- RPC `is_app_admin()`
- Storage bucket publik `app-assets`
- RLS + explicit grants dan storage hardening untuk branding
- optional assignment reminder scheduler bila pg_cron tersedia

## 6. Akses Admin

Panel Admin dapat dibuka oleh akun yang memiliki `class_members.role = 'admin'` atau yang terdaftar di `system_admins`.

Di panel Admin tersedia:

- Nama aplikasi
- Nama singkat
- Tagline
- Warna utama
- Logo
- Judul halaman login
- Deskripsi halaman login
- Status Supabase / Turnstile / VAPID

Logo disimpan ke Supabase Storage dan URL-nya dicatat pada `app_settings`.

## 7. Secret

Jangan commit atau memasukkan ke `VITE_*`:

- Supabase service role / secret keys
- Turnstile secret key
- VAPID private key
- `PUSH_WEBHOOK_SECRET`
- database passwords

## 8. Verifikasi akhir

```powershell
cd web
npm install
npm run typecheck
npm run build
```

Hasil build harus membuat `web/dist/`.
