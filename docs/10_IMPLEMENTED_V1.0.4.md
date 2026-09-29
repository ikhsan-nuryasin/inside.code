# Student Hub v1.0.4 — Implemented Modules

v1.0.4 removes the remaining class-module placeholders from v1.0.3 and implements the core flows end-to-end in the PWA client.

## Implemented

- Class member list and class-admin role management
- Remove member with server-side last-admin guard
- Class settings editor
- Task creation and task progress
- Checklist view/progress
- Schedule and subject creation
- Materials and external-link materials
- Announcements + mark-as-read
- Forum topics and replies
- Groups, members and group tasks
- Poll creation, options, votes and counts
- Class cash: balance, transactions, dues, member payment, admin verification
- Class file upload to private Supabase Storage, signed URL open
- Albums and photo upload to private class photo storage
- Shared notes with optimistic version RPC
- In-app notifications loaded from Supabase and refreshed through Realtime while the app is open
- Server-triggered notifications for assignments, announcements and forum replies
- Profile editing
- PWA manifest and service worker fallback
- Offline IndexedDB caching retained for core reads and sync queue for text writes

## Explicit limitations

- File/photo upload requires internet. Offline text changes can be queued.
- Browser background execution can be throttled. The app syncs on reconnect, when the app is opened, and on manual sync.
- Push notifications require a separate browser notification permission/service worker push integration; v1.0.4 implements in-app notifications only.
- Photo thumbnails are represented in the list; the signed-url gallery preview can be added without changing the database model.
