# Student Hub v1.6.0 — Web Push Notifications

Student Hub now supports standards-based Web Push so notifications can appear outside the open application. The browser registers a PushSubscription, the subscription is stored under per-user RLS, a Supabase Edge Function sends encrypted Web Push messages using VAPID, and the service worker displays persistent notifications. Push notifications require a service worker and permission; on mobile, use the service-worker notification API.

## Components

- `web/src/lib/push.ts` — browser permission, subscription, device registration, preference sync, test push.
- `web/public/sw.js` — `push` and `notificationclick` handlers.
- `supabase/migrations/021_notification_type_expansion.sql` — notification enum expansion.
- `supabase/migrations/022_web_push_notifications.sql` — `push_subscriptions` table + RLS.
- `supabase/migrations/023_notification_coverage.sql` — server-generated notifications for additional class events.
- `supabase/functions/send-notification-push` — webhook sender + authenticated test sender.

## Generate VAPID keys

From the `supabase` directory:

```bash
node generate-vapid.mjs
```

Output values:

- `VITE_VAPID_PUBLIC_KEY` → browser build variable.
- `VAPID_PUBLIC_JWK` → Edge Function secret.
- `VAPID_PRIVATE_JWK` → Edge Function secret.
- `VAPID_SUBJECT` → Edge Function secret, for example `mailto:admin@example.com`.

Never put the private JWK in `web/.env*` or client source. Supabase documents keeping secrets in Edge Function environment variables; the browser should only receive the public key.

## Deploy migrations

Run migrations 001 through 023 in numeric order. If you use Supabase CLI:

```bash
supabase db push
```

## Deploy the Edge Function

```bash
supabase functions deploy send-notification-push
```

Set secrets in the Supabase Dashboard or CLI:

```bash
supabase secrets set VAPID_PUBLIC_JWK='...'
supabase secrets set VAPID_PRIVATE_JWK='...'
supabase secrets set VAPID_SUBJECT='mailto:admin@example.com'
supabase secrets set PUSH_APP_URL='https://studenthub.example.com'
supabase secrets set PUSH_WEBHOOK_SECRET='replace-with-a-long-random-secret'
```

Supabase recommends storing sensitive values in Edge Function secrets rather than bundling them into frontend code.

## Configure Database Webhook

In Supabase Dashboard → Database → Webhooks, create an `INSERT` webhook for `public.notifications` targeting the `send-notification-push` Edge Function. Add:

```text
x-student-hub-webhook-secret: <the same PUSH_WEBHOOK_SECRET>
Content-Type: application/json
```

The Edge Function rejects webhook requests without the configured secret.

## Browser setup

Build production with:

```env
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_VAPID_PUBLIC_KEY=...
```

Then:

```bash
npm install
npm run typecheck
npm run build
npm run preview
```

Open Student Hub, sign in, then open **Pengaturan → Notifikasi perangkat → Aktifkan notifikasi perangkat**. Permission is intentionally requested from this user action rather than automatically.

Press **Kirim notifikasi tes**. The expected path is:

```text
Browser permission
  → PushSubscription
  → push_subscriptions row
  → Edge Function test
  → Web Push service
  → Service Worker
  → system notification
```

For normal app events, the `notifications` INSERT webhook performs the same final delivery automatically.

## iPhone / iPad

For iOS/iPadOS, add Student Hub to the Home Screen and open it as a Web App before enabling push. Web Push for Home Screen web apps is supported from iOS/iPadOS 16.4 onward.

## Important distinction

- Foreground: Student Hub can show the existing in-app popup and the system push pipeline can also deliver a persistent notification.
- Background/closed: the service worker can receive the push and show a persistent notification.
- Local deadline reminders previously generated only in the open page are not equivalent to a server-side scheduled reminder. To make deadline reminders work while the app is closed, schedule server-side creation of reminder rows using Supabase Cron/pg_cron.
