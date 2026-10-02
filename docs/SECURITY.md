# Inside Code — Security Notes

## Browser variables

Yang boleh masuk bundle browser hanya konfigurasi publik:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY
VITE_TURNSTILE_SITE_KEY
VITE_CAPTCHA_REQUIRED
```

Jangan pernah memasukkan:

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_PASSWORD
TURNSTILE_SECRET_KEY
VAPID_PRIVATE_JWK
PUSH_WEBHOOK_SECRET
```

## Auth

Inside Code selalu menggunakan Supabase Auth. Tidak ada bypass login atau Demo Mode.

CAPTCHA/Turnstile diterapkan pada alur autentikasi yang dipakai aplikasi.

MFA/TOTP dapat digunakan untuk akun yang membutuhkan verifikasi dua langkah.

## RLS

Migration `034_restore_rls_helper_exec_and_fix_app_admin.sql` melakukan dua koreksi penting:

1. Mengembalikan `EXECUTE` untuk helper authorization yang memang dipanggil oleh RLS policy. Tanpa privilege ini, query authenticated dapat gagal saat policy menjalankan helper tersebut.
2. Menghapus `class_members.role = 'admin'` sebagai sumber global app-admin. Global administrator hanya berasal dari tabel `system_admins`.

## Storage

Bucket `app-assets` boleh dibaca publik agar branding dapat tampil sebelum login. Operasi tulis/ubah/hapus dibatasi dengan fungsi `is_app_admin()` dan prefix `branding/`.

## Offline data

Cache dan file offline berada di IndexedDB. Logout semua perangkat harus membersihkan data lokal agar sesi berikutnya tidak membaca cache/queue lama.

## Release hygiene

Jangan commit:

```text
.env
.env.local
.env.production
node_modules/
dist/
supabase/.temp/
```

Perubahan database production dilakukan melalui migration baru dan bukan dengan mengedit migration lama.
