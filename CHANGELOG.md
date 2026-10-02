# Changelog — Inside Code

## v1.8.15

- Demo Mode dihapus dari aplikasi dan build pipeline.
- Data dummy/demo dihapus dari source frontend.
- Autentikasi sekarang selalu menggunakan Supabase.
- CAPTCHA/Turnstile dan MFA tidak lagi memiliki jalur bypass demo.
- Cache file offline diperbaiki agar benar-benar mengambil file remote sebelum disimpan ke IndexedDB.
- Logout semua perangkat membersihkan cache, queue, metadata, dan file lokal.
- Default tanggal menggunakan tanggal lokal, bukan UTC.
- Service worker cache dinaikkan ke namespace `inside-code-v1.8.15-security-push`.
- Migration `034_restore_rls_helper_exec_and_fix_app_admin.sql` memperbaiki privilege EXECUTE helper RLS dan menghapus legacy `class_members.role='admin'` sebagai sumber global app-admin.

## Deployment rule

Gunakan hanya environment production yang valid. Jangan commit `.env`, password database, service-role key, VAPID private key, Turnstile secret, atau webhook secret.
