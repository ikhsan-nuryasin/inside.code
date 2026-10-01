# Inside Code v1.8.3 — Supabase deploy via GitHub

This project deploys the Supabase database migrations and the `send-notification-push` Edge Function from GitHub Actions.

## GitHub Secrets required

Create only these two repository secrets:

- `SUPABASE_ACCESS_TOKEN` — Supabase Personal Access Token.
- `SUPABASE_DB_PASSWORD` — PostgreSQL database password for the Supabase project.

The project ID is already fixed in the workflow:

```text
nxjwctumtkgcyghuzfwm
```

## Run

1. Push the repository to `main`.
2. Open **GitHub → Actions → Deploy Inside Code to Supabase**.
3. Choose **Run workflow** and branch `main`.
4. Wait for both migration and Edge Function steps to pass.

The workflow runs:

```text
supabase db push --project-ref nxjwctumtkgcyghuzfwm --password "$SUPABASE_DB_PASSWORD"
supabase functions deploy send-notification-push --project-ref nxjwctumtkgcyghuzfwm
```

## Important

Do not commit:

- database passwords
- Supabase access tokens
- Turnstile secret key
- VAPID private key
- webhook secrets

The browser-side `VITE_*` values belong to the frontend build and must not contain server secrets.
