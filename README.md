# Inside Code v1.8.12

Production React/Vite PWA for the Inside Code student class platform.

This release is prepared for GitHub + Cloudflare Workers Builds + Supabase hosted production.

## What this release fixes

- Corrects Supabase email verification redirects so signup/resend links return to the current app origin instead of falling back to `localhost:3000`.
- Detects `otp_expired` / `access_denied` verification-link failures and provides a resend-verification action.
- Keeps Supabase as the authoritative password policy; frontend password rules are advisory only.
- Keeps CAPTCHA on login, signup, recovery, and resend flows.
- Provides branded Supabase Auth email templates.
- Advances the service-worker cache namespace to v1.8.12.
- Uses Cloudflare Build settings documented in `docs/DEPLOYMENT.md`.

## Repository layout

```text
.github/workflows/      Supabase deployment workflow
supabase/migrations/    Database migrations 001 → 031
supabase/functions/     Edge Function(s)
supabase/email-templates Custom Auth email HTML
supabase/scripts/        Management API helper for templates
web/                    React/Vite frontend
```

## Production Cloudflare settings

```text
Root directory: web
Build variable: SKIP_DEPENDENCY_INSTALL=true
Build command: npm install --include=dev --no-audit --no-fund && npm run build
Deploy command: npx wrangler deploy
```

Production frontend variables:

```text
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://nxjwctumtkgcyghuzfwm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_VAPID_PUBLIC_KEY=<vapid-public-key>
VITE_CAPTCHA_REQUIRED=true
VITE_TURNSTILE_SITE_KEY=<turnstile-site-key>
```

Never commit `.env`, service-role keys, database passwords, SMTP passwords, Turnstile secret keys, VAPID private keys, or webhook secrets.

## Custom email

Hosted Supabase projects are configured from Authentication → Email Templates. The package includes:

- `confirmation.html`
- `recovery.html`
- `magic_link.html`
- `email_change.html`
- `invite.html`
- `reauthentication.html`

Use `{{ .ConfirmationURL }}` in link buttons. Do not hard-code `localhost` into the email templates.

See `supabase/email-templates/README.md` and `docs/DEPLOYMENT.md`.
