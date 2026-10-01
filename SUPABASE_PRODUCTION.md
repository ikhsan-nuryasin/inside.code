# Inside Code v1.8.3 — Supabase Production Checklist

## Migration

Jalankan seluruh migration `001` sampai `029` secara berurutan.

Migration terbaru:

`029_inside_code_security_and_scheduler_fixes.sql`

Migration ini menambahkan:

- `public.app_settings` untuk branding aplikasi.
- `public.system_admins` untuk admin tambahan.
- `public.is_app_admin()` sebagai pemeriksaan akses admin.
- Storage bucket publik `app-assets` untuk logo aplikasi.
- RLS agar setting hanya dapat diubah oleh app admin.
- explicit table grants dan storage path hardening.
- scheduler deadline 15 menit bila pg_cron tersedia.

## Admin pertama

App admin otomatis mengenali user yang memiliki `class_members.role = 'admin'` dan `status = 'active'`.

Untuk memberikan akses global kepada user tertentu, gunakan SQL Editor Supabase setelah mengetahui UUID user dari Authentication → Users:

```sql
insert into public.system_admins (user_id)
values ('UUID_USER_KAMU')
on conflict (user_id) do nothing;
```

Tidak ada policy browser untuk membuat `system_admins`; penambahan global admin dilakukan operator melalui SQL Editor.

## Branding

`app_settings` dapat dibaca publik agar nama/logo dapat tampil pada halaman login sebelum autentikasi.

Yang dapat diubah dari panel Admin:

- Nama aplikasi
- Nama singkat
- Tagline
- Warna utama
- Logo
- Judul login
- Deskripsi login

Logo disimpan di `app-assets` dengan batas 2 MB.

## Auth / CAPTCHA

- Aktifkan Confirm Email sesuai kebutuhan.
- Konfigurasikan Turnstile pada Supabase Auth Bot Protection.
- Site key adalah nilai publik.
- Secret key tetap hanya pada konfigurasi server/Supabase.
- Uji sign-in, sign-up, dan password recovery.

## RLS / Storage

- Pertahankan RLS pada tabel exposed.
- Jangan menaruh service-role atau secret key pada frontend.
- Bucket `avatars`, `class-files`, dan `class-photos` tetap private.
- Bucket `app-assets` sengaja public karena logo harus dapat dibaca sebelum login.
