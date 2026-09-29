# Security

## Client key
Use only:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never ship:
- `sb_secret_*`
- `service_role`
- server tokens
- OAuth client secrets

## Database
Every exposed public table must have RLS. Policies should use class membership or owner checks.

## Class isolation
A member of class A must not be able to read/write class B data by changing URL/query parameters.

## Storage
Buckets are private. Generate access using authenticated policies/signed URLs.

## Files
Validate extension, MIME, and size in UI and again in trusted backend/Storage rules where practical.

## Audit
Sensitive class-management operations and cash transactions should be logged to `activity_logs`.
