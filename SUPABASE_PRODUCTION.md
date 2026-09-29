# Supabase Production Checklist

## Required

- Create a Supabase project.
- Apply migrations 001–027 in order.
- Keep RLS enabled.
- Keep storage buckets private.
- Configure Auth redirect/site URL.
- Provision users, classes, memberships, and class positions.
- Test cross-class isolation with two student accounts.

## Do not expose

- `service_role` key
- `sb_secret_*`
- database passwords
- server-side admin tokens

The browser should only receive the Supabase project URL and publishable client key.

## Storage

Student Hub expects private storage with authenticated access and signed URLs. Do not convert sensitive buckets to public just to make downloads easier.

## Provisioning

The browser application intentionally does not create classes or allow self-service joining. Use the controlled operator/database workflow described in `docs/14_DATA_PROVISIONING.md`.


## Auth security

- Enable Confirm Email for hosted production projects.
- Enable CAPTCHA under Authentication → Bot and Abuse Protection and choose Cloudflare Turnstile.
- Store the Turnstile secret key in Supabase Auth configuration, not in frontend code.
- Review Authentication → Rate Limits for signup, sign-in, recovery, verification, token refresh, and MFA challenge traffic.
- Encourage or require TOTP MFA according to your class/organization risk profile.

See `docs/41_V1.8.0_SECURITY_HARDENING.md`.


## v1.8.1 monthly cash patch

Run migration `027_cash_month_summary_zero_state.sql` after 026. It hardens the monthly cash RPC so a month with no transactions still returns a zero-valued summary row.
