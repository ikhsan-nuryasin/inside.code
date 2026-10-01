# Inside Code v1.8.3 — Migration 012 Fix

The first Supabase deployment stopped at migration 012 because the migration attempted to revoke privileges from a legacy `create_class(text,text,integer,text,text)` overload that had already been removed by migration 009.

Migration 012 is now safe on a fresh database: it checks whether each function signature exists before running `REVOKE`.

The GitHub Actions workflow also uses Supabase CLI's `--yes` global flag so CI does not wait for an interactive confirmation prompt.

## What to do

1. Replace the existing project with this version, keeping the existing `.git` folder.
2. Commit and push to `main`.
3. In GitHub Actions, run **Deploy Inside Code to Supabase** again.
4. Do not reset the database. Migrations 001–011 were already applied before migration 012 failed; the next `db push` should continue from the pending migration.

Required GitHub repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

No third secret is required because the project ID is stored in the workflow.
