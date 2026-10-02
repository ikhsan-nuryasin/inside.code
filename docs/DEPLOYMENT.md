# Inside Code v1.8.16 — Production Deployment

## A. Cloudflare Workers Builds

Repository: `https://github.com/ikhsan-nuryasin/inside.code`
Branch: `main`
Root directory: `web`

Recommended build configuration while this repository intentionally rebuilds dependencies from `package.json`:

```text
SKIP_DEPENDENCY_INSTALL=true
Build command : npm install --include=dev --no-audit --no-fund && npm run build
Deploy command: npx wrangler deploy
```

`SKIP_DEPENDENCY_INSTALL` prevents Cloudflare's automatic `npm clean-install` step. The build command then installs devDependencies explicitly so TypeScript and Vite are available.

Required production build variables:

```text
VITE_SUPABASE_URL=https://nxjwctumtkgcyghuzfwm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_VAPID_PUBLIC_KEY=<vapid-public-key>
VITE_CAPTCHA_REQUIRED=true
VITE_TURNSTILE_SITE_KEY=<turnstile-site-key>
```

Do not put service-role keys, database passwords, SMTP passwords, Turnstile secret keys, VAPID private keys, or webhook secrets in `VITE_*` variables.

## B. Supabase URL configuration

For hosted Supabase:

1. Authentication → URL Configuration.
2. Site URL:
   `https://inside-code.yasinikhhsan2.workers.dev`
3. Additional Redirect URLs:
   `https://inside-code.yasinikhhsan2.workers.dev`
   `http://localhost:5173`
4. Save.

The application now supplies `emailRedirectTo: window.location.origin` for signup and resend-confirmation requests. Email templates must use `{{ .ConfirmationURL }}` so Supabase can honor the redirect selected by the application.

## C. Custom Auth email templates

Hosted Supabase projects are configured from Authentication → Email Templates. The package contains ready-to-paste HTML files in `supabase/email-templates/`:

```text
confirmation.html       → Confirm sign up
recovery.html            → Reset password
magic_link.html          → Magic Link
email_change.html        → Change email address
invite.html              → Invite user
reauthentication.html    → Reauthentication
```

The templates use `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .NewEmail }}`, and other documented Supabase template variables. Do not replace `{{ .ConfirmationURL }}` with a hard-coded localhost URL.

You can apply all six hosted templates with the included Management API helper:

```powershell
$env:SUPABASE_ACCESS_TOKEN="YOUR_MANAGEMENT_API_TOKEN"
$env:PROJECT_REF="nxjwctumtkgcyghuzfwm"
node supabase/scripts/apply-auth-email-templates.mjs
```

The Management API token is read only from the environment and is never written to the repository.

## D. Custom SMTP

For production delivery to normal user addresses, configure Custom SMTP in Supabase Authentication settings. Use a verified sender such as:

```text
Sender name: Inside Code
From address: noreply@your-domain.example
```

Configure SPF, DKIM, and DMARC with your mail provider. Supabase documents Resend, AWS SES, Postmark, SendGrid, ZeptoMail, and Brevo as SMTP-compatible providers.

Do not paste SMTP credentials into source files.

## E. GitHub Actions / Supabase

Repository secrets:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
```

Project ref:

```text
nxjwctumtkgcyghuzfwm
```

The workflow pushes migrations `001 → 034` and deploys `send-notification-push`.

## F. Local verification

```powershell
cd web
npm install
npm run typecheck
npm run build
npm run dev
```

The current production guard requires:

```text
```

for production builds.

## G. Email verification testing

Never reuse an old `otp_expired` email. Register again or resend verification from the application.

The auth page now detects `otp_expired` / `access_denied` fragments, shows a clear message, and provides a `Kirim ulang email verifikasi` action.

Test in this order:

```text
1. Open http://localhost:5173
2. Register a test account
3. Complete Turnstile
4. Check the new email
5. Click the newest verification link
6. Confirm it returns to localhost:5173
7. Test login
8. Repeat on production URL
```

## H. Caching

Service-worker cache namespace is `inside-code-v1.8.16-security-push`. After deploying a new version during testing, use a hard refresh or an incognito window to avoid an older cached bundle.
