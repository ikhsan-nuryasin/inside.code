# Student Hub v1.5.5 — Deployment Guide

## 1. What is actually hosted

Only the Vite output in `web/dist` is the browser application. Supabase hosts the database, authentication, storage, and realtime backend separately.

Do **not** upload `.env.local`, Supabase secrets, or development files to a public static host.

## 2. Supabase production setup

Run these migrations in order in Supabase SQL Editor:

```text
001_initial_schema.sql
002_functions_triggers_indexes.sql
003_rls_policies.sql
004_storage_policies.sql
005_shared_notes_rpc.sql
006_storage_buckets.sql
007_security_integrity_fixes.sql
008_notification_triggers.sql
009_class_modes_and_schedule_template.sql
010_class_officers_attendance_group_leader.sql
011_role_based_workflow_hardening.sql
012_disable_legacy_class_creation.sql
013_remove_internal_attendance.sql
014_phase1_authorization_hardening.sql
015_phase2_feature_completion.sql
016_phase3_sync_cursor.sql
017_phase3_storage_and_sync_hardening.sql
018_randomizer_presentation_history.sql
019_class_productivity_upgrade.sql
020_support_bug_reports.sql
```

Migration 013 removes the legacy internal attendance model. That is intentional.

After migration:

- confirm RLS is enabled on exposed application tables;
- keep Storage buckets private;
- configure class memberships and roles through the operator workflow;
- create at least one test student in a test class;
- test a non-member cannot read or mutate another class.

## 3. Build the production PWA

Use Node.js 20.19+.

```powershell
cd web
npm install
copy .env.example .env.local
```

Set:

```env
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Then:

```powershell
npm run typecheck
npm run build
```

Expected output folder:

```text
web/dist/
```

## 4. Vercel

In the Vercel project settings:

- Root Directory: `web`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
- Node.js: 20.x or newer

Environment Variables:

```text
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

The included `vercel.json` adds safe response headers. Hash-based navigation means no application-server rewrite is required.

## 5. Netlify

The included `web/netlify.toml` is ready for:

- Build command: `npm run build`
- Publish directory: `dist`

Set the same three environment variables in Netlify.

## 6. Cloudflare Pages

Build command:

```text
npm run build
```

Build output directory:

```text
dist
```

Project root:

```text
web
```

Set the same three environment variables.

## 7. cPanel / shared hosting / InfinityFree-style static hosting

Build locally first:

```powershell
cd web
npm install
npm run typecheck
npm run build
```

Open:

```text
web/dist
```

Upload the **contents** of `dist` into the public document root, for example:

```text
public_html/
```

or the host's assigned `htdocs` directory.

Do not upload the React source as the production document root unless your host provides a Node build environment. Static shared hosting only needs the files generated in `dist`.

The included `.htaccess` is copied into `dist` by Vite and provides safe headers plus an SPA fallback for ordinary HTTP paths.

## 8. Custom domain

Point the domain/subdomain to the selected host, then enable HTTPS. Do not use HTTP for the production app.

## 9. Supabase Auth URLs

In Supabase Auth settings, add the production site URL to the allowed Site URL / redirect configuration. Examples:

```text
https://studenthub.example.com/
```

and, if a separate preview domain is used, add that preview domain too.

## 10. WhatsApp quick messages

The application prepares a message and opens WhatsApp for the user. It does not send WhatsApp messages automatically and does not require a WhatsApp API server.

## 11. PWA verification

After deployment:

1. Open the HTTPS site on Android Chrome.
2. Confirm the app is installable.
3. Install it.
4. Close and reopen the installed app.
5. Disable network and confirm cached screens remain usable.
6. Re-enable network and confirm queued changes synchronize.
7. Deploy a new version and confirm the update prompt appears.

## 12. Required production tests

```text
[ ] HTTPS works
[ ] VITE_DEMO_MODE=false
[ ] No secret/service-role key in client config
[ ] Supabase Auth login works
[ ] Password reset works
[ ] Cloudflare Turnstile is enabled in Supabase Auth
[ ] VITE_CAPTCHA_REQUIRED=true and VITE_TURNSTILE_SITE_KEY configured
[ ] MFA challenge works for an enrolled account
[ ] Global sign-out works
[ ] Security headers are present in production
[ ] User can only access assigned classes
[ ] RLS blocks cross-class access
[ ] Private Storage blocks anonymous access
[ ] Signed URLs work for authorized files
[ ] Task CRUD works
[ ] Calendar works
[ ] Randomizer works
[ ] Cash verification works
[ ] Bug report works
[ ] Quick WhatsApp message opens correctly
[ ] Notification popup works
[ ] PWA installs
[ ] Offline cache works
[ ] Outbox retry works
[ ] Service worker update works
[ ] Mobile viewport has no horizontal overflow
[ ] Browser console has no fatal runtime errors
```

## Web Push

See `docs/40_WEB_PUSH_NOTIFICATIONS.md` for VAPID generation, Edge Function deployment, Database Webhook, and device setup.
