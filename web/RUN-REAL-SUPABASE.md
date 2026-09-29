# Student Hub v1.6.0 — Real Supabase Setup

Use the migration files in `../supabase/migrations/` from 001 through 020 in numeric order.

Set `VITE_DEMO_MODE=false` and provide only the publishable Supabase key. Never put a service-role/secret key in the client.

After provisioning users, classes, memberships, and positions through the operator workflow, run `npm run typecheck` and `npm run build`. Deploy `web/dist`.
