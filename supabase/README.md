# Inside Code — Supabase

Migrations are applied in numeric order:

```text
001 → 002 → 003 → ... → 029 → 030
```

`030_security_hardening.sql` is the post-deployment security hardening migration.

The `send-notification-push` Edge Function lives under:

```text
supabase/functions/send-notification-push/
```

Required Edge Function secrets:

```text
VAPID_PUBLIC_JWK
VAPID_PRIVATE_JWK
VAPID_SUBJECT
PUSH_APP_URL
PUSH_WEBHOOK_SECRET
```

Never commit database passwords, access tokens, Turnstile Secret Key, VAPID private key, or webhook secret.
