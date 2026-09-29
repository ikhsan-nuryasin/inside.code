# Student Hub v1.8.1 — Supabase

Run migrations in exact numeric order:

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
021_notification_type_expansion.sql
022_web_push_notifications.sql
023_notification_coverage.sql
024_assignment_deadline_scheduler.sql
025_cash_monthly_summary.sql
026_cash_payment_ledger_link.sql
027_cash_month_summary_zero_state.sql
```

## Product boundaries

- Attendance is not a product feature. Migration 013 removes the legacy attendance model.
- Student client cannot create a class or join a class.
- Classes and memberships are provisioned by a controlled operator/database-admin workflow.
- Storage buckets are private.
- RLS is mandatory.

## Client credentials

The browser uses only:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Never ship `service_role`, `sb_secret_*`, database passwords, or server admin tokens.

## Production testing

Use `supabase/tests/RLS_TEST_PLAN.md` and `supabase/tests/IMPLEMENTATION_SECURITY_NOTES.md` before release.

## Web Push

Student Hub now supports browser Web Push for system notifications outside the app. The browser stores only its own subscription row under RLS; the VAPID private key is server-only.

Required production secrets for the `send-notification-push` Edge Function:

```text
VAPID_PUBLIC_JWK
VAPID_PRIVATE_JWK
VAPID_SUBJECT
PUSH_APP_URL
PUSH_WEBHOOK_SECRET
```

Generate a new VAPID pair with:

```bash
node generate-vapid.mjs
```

Only the `VITE_VAPID_PUBLIC_KEY` output goes into the browser app. The JWK values and webhook secret belong in Supabase Edge Function Secrets.

### Production delivery flow

1. Deploy `send-notification-push` to Supabase Edge Functions.
2. Set the five secrets above.
3. In Supabase Dashboard, create a Database Webhook for `public.notifications` on `INSERT`, target the `send-notification-push` Edge Function, and add header `x-student-hub-webhook-secret` with the exact `PUSH_WEBHOOK_SECRET`.
4. In the browser, sign in and enable **Notifikasi perangkat** from Pengaturan.
5. Press **Kirim notifikasi tes** and verify the device notification tray.

System notifications require a service worker, push subscription, server-side sender, and permission granted by the user. On iPhone/iPad, the web app must be added to the Home Screen before enabling Web Push.

## Web Push implementation

Files added in v1.6.0:
- `migrations/021_notification_type_expansion.sql`
- `migrations/022_web_push_notifications.sql`
- `migrations/023_notification_coverage.sql`
- `functions/send-notification-push/`

Full deployment steps are in `docs/40_WEB_PUSH_NOTIFICATIONS.md`.

### v1.7.0
- Run migration `025_cash_monthly_summary.sql` after 024 for monthly class cash reporting, then 026 for ledger linking and 027 for zero-state summary hardening.
