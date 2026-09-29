# Supabase Production Checklist

## Apply database changes
Run every migration in `supabase/migrations/` in numeric order from `001` through `027`.

## Security
- Keep RLS enabled on exposed application tables.
- Keep sensitive Storage buckets private.
- Do not expose `service_role`, `sb_secret_*`, database passwords, or server-side admin tokens.
- Configure Auth redirect/site URL for the production origin.
- Enable Confirm Email as appropriate for the production project.
- Configure CAPTCHA/Turnstile in Supabase Auth.
- Review Auth rate limits.
- Test TOTP MFA and global sign-out.
- Test cross-class isolation using separate student accounts.

## Provisioning rules
The browser does not create classes and does not provide self-service class joining. Provision users, classes, memberships, and class positions through the controlled operator/database workflow.

## Web Push
Keep VAPID private values and `PUSH_WEBHOOK_SECRET` in Supabase Edge Function secrets. Only the VAPID public key is exposed to the browser.

## Monthly cash
Migrations 025–027 contain the monthly cash summary and zero-state hardening changes and must be applied in order.
