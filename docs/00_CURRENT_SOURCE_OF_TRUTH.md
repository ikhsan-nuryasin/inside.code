# Student Hub v1.5.5 — Current Source of Truth

This document supersedes older planning/release notes when they conflict with the v1.5.5 source tree.

## Product boundaries

- Student-only application.
- No lecturer accounts/module.
- No attendance or presence feature.
- Official campus attendance remains outside Student Hub.
- No create-class action in the client.
- No join-class action in the client.
- No public member directory.
- A class supports `offline` and `online` delivery modes.
- Documentation and Cash remain separate modules.

## Current major modules

Dashboard, Classes, Tasks, Calendar, Materials, Announcements, Forum, Groups, Randomizer, Polls, Cash, Documentation, Notes, Administration, Notifications, Search, Help/Bug Reports, Quick WhatsApp Messages, Settings, Offline Sync, and PWA Update/Install.

## Leadership positions

Exactly four class-wide positions are supported:

1. Ketua Kelas
2. Wakil Ketua
3. Sekretaris
4. Bendahara

One student may hold only one class-wide position, and a class has at most one holder per position.

## Group leader

Group leader is independent from class-wide positions. It can be selected by wheel/random mode or manually. The server validates group membership.

## Randomizer

The randomizer supports:

- group-leader selection;
- presentation-order selection;
- random member selection.

Presentation results can be saved and connected to the class calendar.

## Notifications

Notifications have a notification center plus popup presentation. Popup preferences are configurable. Popup actions should deep-link to the relevant resource when the notification contains a supported target.

## Offline

IndexedDB stores application cache, mutation outbox, and sync metadata. Supabase remains the authoritative server. New binary uploads still require an active connection. Cached files remain available offline.

## Security

Supabase RLS is authoritative. Client-side role checks are only for UX. Never put a Supabase secret/service-role key in the browser.

## Database

The active migration sequence is **001 through 020**. Migration 013 removes the historical attendance model. Migration 020 adds support/bug reports.

## Hosting

The frontend is a static Vite application. Production output is `web/dist`. Supabase hosts Auth, Postgres, Storage, and Realtime. Vercel, Netlify, Cloudflare Pages, and cPanel/shared static hosting are supported by the deployment bundle.

## Production status

The repository includes source-level audits and deployment configuration. Production certification still requires a successful local/CI dependency install, `npm run typecheck`, `npm run build`, real Supabase RLS/Storage tests, and browser/PWA testing.
