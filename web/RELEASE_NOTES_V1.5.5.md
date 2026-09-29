# Student Hub v1.6.0 — Stability & UX Hardening

## Stability
- Correct app TypeScript check now targets `tsconfig.app.json` directly.
- Fixed calendar selected-date declaration order and exact selected-date event filtering.
- Class quick actions use class-scoped deep links.
- Replaced native browser dialog flows with the Student Hub dialog host.
- Hardened dialog request queue against stale React closures.

## Offline / Sync
- Sync invalidates only affected cache namespaces instead of clearing the entire cache.
- Composite-key attachment mutations carry explicit match keys for offline replay.
- Personal note deletion removes the item from the local cache optimistically.
- Notification read state updates local cache optimistically.
- Sync cursor processing is ordered before cursor persistence.

## Demo parity
- Demo state now persists class events, activity logs, forum reports, admin notes, randomizer history, poll votes, and attachments.

## Product rules retained
- No attendance/presence.
- No lecturer module.
- No client-side class creation.
- No client-side self-join.
