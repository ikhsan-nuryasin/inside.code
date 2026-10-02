# Changelog — Inside Code v1.8.12

### Auth / Email
- Signup now sends verification links back to the current app origin.
- Resend verification now uses the current app origin.
- Added user-facing handling for expired/invalid verification links.
- Added one-click resend flow after unverified login or expired link.
- Added branded Supabase Auth templates: confirmation, recovery, magic link, email change, invite, and reauthentication.

### Build / PWA
- Service worker cache namespace advanced to v1.8.12.
- Production settings documentation updated for Cloudflare Build Variables.
- Application version label updated to v1.8.12.

### Security
- No secrets are stored in frontend source or template files.
- Custom SMTP configuration remains external to the repository.
