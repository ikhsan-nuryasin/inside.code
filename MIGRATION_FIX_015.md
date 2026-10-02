# Inside Code v1.8.3 — Migration 015 Fix

Migration 015 previously attempted to create four policies that migration 010 had already created:
- assignments_insert_leadership
- announcements_insert_secretary
- announcements_update_secretary
- announcements_delete_secretary

The migration is now idempotent: it drops the exact policy name before recreating it.

Because migration 015 had not completed successfully in the remote project, replacing this file and rerunning the GitHub Actions workflow is safe. Do not reset the database.
