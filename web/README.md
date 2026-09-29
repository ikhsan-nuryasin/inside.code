# Student Hub PWA v1.8.1

Security hardening: Turnstile CAPTCHA on auth, local login abuse guard, TOTP MFA gate, security center, and production security headers.

# Student Hub Web v1.8.1

React + Vite PWA frontend. v1.8.1 includes refined Randomizer flows and monthly class cash reporting while preserving v1.8.0 security, CAPTCHA, MFA, and Web Push features.

## Commands

```powershell
npm install
npm run typecheck
npm run build
npm run audit:hosting
npm run verify
```

Production build: `dist/`.

Deploy `dist/` to a static HTTPS host. Backend is Supabase.

Production `.env` must set `VITE_CAPTCHA_REQUIRED=true` and `VITE_TURNSTILE_SITE_KEY`.


## v1.8.1
Randomizer refined + monthly class cash UX. See RANDOMIZER_V1.8.1.md and CASH_MONTHLY_V1.8.1.md.
