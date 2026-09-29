# Hosting Summary

## Recommended setup

```text
                    HTTPS HOST
                (Vercel / Netlify /
             Cloudflare / cPanel)
                        │
                     web/dist
                        │
                        ▼
               Student Hub PWA
                        │
                        ▼
                    Supabase
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
       Auth          Postgres       Storage
         │              │              │
         └──────────────┼──────────────┘
                        ▼
                     Realtime
```

The static host serves the frontend. Supabase is the backend. No PHP server and no local MySQL database are required for the Student Hub production architecture.

## Production rule

Never ship the app with `VITE_DEMO_MODE=true`. The v1.5.5 build now blocks `npm run build` unless production mode is explicitly `false` and a valid Supabase URL + publishable key are configured.

## Web Push (v1.6.0)
The release now includes standards-based Web Push using a browser PushSubscription, Supabase `push_subscriptions` with RLS, VAPID keys stored only as Edge Function secrets, a `send-notification-push` Edge Function, and a service worker push/click handler. Normal notification rows are intended to be delivered through a Supabase Database Webhook on `public.notifications` INSERT. See `docs/40_WEB_PUSH_NOTIFICATIONS.md`.

## v1.7.0
Added monthly cash RPC migration 025 and improved randomizer/presentation scheduling. Run migrations through 025 before production.
