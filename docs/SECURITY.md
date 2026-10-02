# Inside Code — Security Notes

## Client secrets

Frontend hanya boleh menerima nilai `VITE_*` yang memang aman untuk browser:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY
VITE_TURNSTILE_SITE_KEY
```

Jangan pernah memasukkan:

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_PASSWORD
TURNSTILE_SECRET_KEY
VAPID_PRIVATE_JWK
PUSH_WEBHOOK_SECRET
```

ke bundle frontend.

## Database hardening

Migration `030_security_hardening.sql`:

- menetapkan `search_path` untuk function yang sebelumnya mutable;
- mencabut akses Data API langsung terhadap function trigger/internal yang terdeteksi bisa dijalankan oleh `anon`;
- mempertahankan `authenticated` hanya untuk RPC yang memang digunakan aplikasi;
- tidak mengubah RLS business rules yang sudah berjalan.

Sebagian `SECURITY DEFINER` yang memang menjadi helper RPC aplikasi tetap tersedia untuk `authenticated`. Itu harus tetap diaudit sesuai kebutuhan fitur.

## Storage branding

Bucket `app-assets` boleh dibaca publik agar logo dapat tampil sebelum login. Tulis/hapus hanya untuk app admin dan hanya pada prefix `branding/`.

## Push

VAPID private key dan webhook secret hanya berada di Supabase Edge Function Secrets.
