# Student Hub v1.8.0 — Security Release

- Cloudflare Turnstile pada sign-in, sign-up, password recovery.
- Local login abuse guard dengan temporary lock.
- Generic auth errors untuk mengurangi account enumeration.
- Password policy client-side untuk akun baru.
- TOTP MFA + AAL gate setelah login.
- Global sign-out.
- Security Center di Settings.
- Security navigation entry.
- Production CAPTCHA guard.
- Security audit script.
- CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- Turnstile domain allowance pada hosting configs.


## Deployment notes

Production builds intentionally fail unless Demo Mode is disabled, Supabase is configured, Web Push VAPID public key is present, and Turnstile CAPTCHA is configured.

Migrations bundled in this release: 001–027, including Web Push (021–024) and monthly cash (025–026).
