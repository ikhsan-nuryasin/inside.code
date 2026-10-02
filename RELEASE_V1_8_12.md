# Inside Code v1.8.12

## Included fixes

- Fixed Supabase email verification redirect by passing `emailRedirectTo: window.location.origin` during signup and resend.
- Added expired verification-link handling for `otp_expired` / `access_denied` URL fragments.
- Added a resend-verification action that uses Supabase Auth `resend({ type: 'signup' })` and the current origin.
- Kept frontend password rules advisory only; Supabase Auth remains the server-side authority.
- Kept CAPTCHA tokens on signup, login, reset, and resend flows.
- Fixed service-worker cache namespace to `inside-code-v1.8.12-security-push`.
- Updated the Settings page release label to v1.8.12.
- Added custom Inside Code authentication email templates for hosted Supabase.
- Added a Management API helper to apply the six authentication templates without storing credentials in source.
- Updated deployment documentation for Cloudflare, Supabase redirects, custom SMTP, and email testing.

## Important

Hosted Supabase email templates are configured through the Supabase dashboard (or Management API). HTML files inside this repository do not automatically change the hosted project's email templates until applied.
