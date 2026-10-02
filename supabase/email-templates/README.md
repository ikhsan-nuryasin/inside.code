# Custom Email Inside Code

Template ini untuk Supabase Auth hosted project.

## Hosted Supabase

1. Buka Supabase Dashboard.
2. Pilih project Inside Code.
3. Authentication → Email Templates.
4. Terapkan template:
   - Confirm sign up → `confirmation.html`
   - Reset password → `recovery.html`
   - Magic Link → `magic_link.html`
   - Change email address → `email_change.html`
   - Invite user → `invite.html`
   - Reauthentication → `reauthentication.html`
5. Subject yang disarankan ada di `supabase/scripts/apply-auth-email-templates.mjs`.

Untuk menerapkan semua template sekaligus melalui Management API, jalankan:

```powershell
$env:SUPABASE_ACCESS_TOKEN="TOKEN_SUPABASE_MANAGEMENT"
$env:PROJECT_REF="nxjwctumtkgcyghuzfwm"
node supabase/scripts/apply-auth-email-templates.mjs
```

Token Management API hanya dipakai di komputer/admin environment dan jangan di-commit.

## Custom SMTP

Untuk production gunakan custom SMTP agar email dapat dikirim ke alamat pengguna umum. Supabase mendukung SMTP provider seperti Resend, AWS SES, Postmark, SendGrid, ZeptoMail, dan Brevo. Setelah provider siap, konfigurasi host, port, user, password, From address, dan Sender Name di Authentication → SMTP Settings.

Saran tampilan:

- Sender name: `Inside Code`
- From: `noreply@domain-kamu`
- Subject: singkat dan informatif

Gunakan domain khusus untuk authentication email dan konfigurasikan SPF/DKIM/DMARC pada provider email.
