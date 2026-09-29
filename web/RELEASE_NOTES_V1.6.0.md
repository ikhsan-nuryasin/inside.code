# Student Hub v1.6.0 — System Push Notifications

## Added
- Browser Web Push subscription management.
- Persistent service-worker notifications for background/closed app delivery.
- Notification click deep-link handling.
- Per-device notification preferences shared by popup and system push.
- Settings UI to enable/disable push and send a test notification.
- VAPID generator script.
- Supabase `push_subscriptions` table with RLS.
- Notification type expansion for schedule, material, and documentation.
- Notification coverage for materials, schedules, polls, class events, forum replies, and cash payment status changes.
- Supabase Edge Function for sending Web Push messages.
- Server-side 24-hour and 3-hour assignment reminder generator (`024_assignment_deadline_scheduler.sql`).

## Production configuration
Follow `docs/40_WEB_PUSH_NOTIFICATIONS.md`.

## Important
- Private VAPID keys must never be shipped to the browser.
- Production build requires `VITE_VAPID_PUBLIC_KEY`.
- System push requires HTTPS and user permission.
- iPhone/iPad users must use Student Hub as a Home Screen web app before enabling push.
- Deadline reminders while the app is closed require the Supabase Cron job described in the setup guide.
