# Architecture

```text
Browser / Android Chrome PWA
        │
        ├── React UI
        ├── Service Worker
        ├── IndexedDB
        │     ├── cache
        │     ├── sync_queue
        │     └── meta
        │
        └── Supabase Client
                 │
                 ├── Auth
                 ├── PostgREST / Data API
                 ├── Storage
                 └── Realtime
```

## Data flow online
Server → local cache → UI.

## Data flow offline
Local cache → UI.
Writes that need persistence are recorded to sync queue.

## Data flow after reconnect
sync queue → Supabase → remove queue item on success.

## Authorization
Membership and class admin rights are checked in PostgreSQL RLS, not only in React.

## File handling
Store only metadata in relational tables. Actual files live in private Supabase Storage buckets.
