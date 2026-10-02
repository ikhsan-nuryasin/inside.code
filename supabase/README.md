# Inside Code — Supabase

Migrations are applied in numeric order:

```text
001 → 002 → 003 → ... → 032 → 033 → 034
```

`033_security_definer_execute_hardening.sql` tightened function execution privileges. `034_restore_rls_function_execute_and_global_admin.sql` restores the EXECUTE privileges required by RLS helper functions and removes the legacy class-member admin path from global application-admin authorization.

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
