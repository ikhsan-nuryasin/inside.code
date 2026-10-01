# Inside Code — Supabase deployment via GitHub Actions

This repository is prepared so the Supabase database migrations and the `send-notification-push` Edge Function can be deployed from GitHub Actions. This avoids requiring the local Windows machine to connect directly to the Supabase PostgreSQL pooler.

## GitHub Actions secrets

Repository → Settings → Secrets and variables → Actions → New repository secret.

Add exactly:

- `SUPABASE_ACCESS_TOKEN` — Supabase Personal Access Token.
- `SUPABASE_DB_PASSWORD` — database password for this Supabase project.
- `SUPABASE_PROJECT_ID` — `nxjwctumtkgcyghuzfwm`.

Never commit these values to the repository and never place them inside `VITE_*` variables.

## Deploy

Push the repository to `main`, or open:

Actions → Deploy Inside Code to Supabase → Run workflow.

The workflow will:

1. Install the Supabase CLI.
2. Apply all pending files in `supabase/migrations/`.
3. Deploy `send-notification-push`.
4. Print migration state.

## Edge Function production secrets

The Edge Function still needs its production secrets configured in Supabase Dashboard → Edge Functions → Secrets (or through `supabase secrets set`). Use the real values from your private configuration for:

- `VAPID_PUBLIC_JWK`
- `VAPID_PRIVATE_JWK`
- `VAPID_SUBJECT`
- `PUSH_APP_URL`
- `PUSH_WEBHOOK_SECRET`

Do not put any of these in frontend `VITE_*` variables.
