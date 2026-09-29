# Student Hub — Phased Completion Plan

## Phase 1 — Authorization/Data Integrity (current)
- Finish and test RLS/role boundaries.
- Validate no-attendance invariant.
- Validate offline queue retention.
- Validate current group leader authorization.

## Phase 2 — Feature Completeness
- Materials: attachment upload, preview, offline availability.
- Tasks: checklist CRUD, edit/delete task, attachments.
- Announcements: read state, pin/archive where appropriate.
- Forum: category, pin, edit/delete, reply, report, unread state.
- Groups: full member management, random/manual leader flow, group task CRUD.
- Cash: proof upload, verify/reject, authoritative balance, void/correction.
- Documentation: album CRUD, photo management.
- Secretary administrative notes/notulensi.

## Phase 3 — Full Offline
- Cache all read-heavy domains.
- Outbox for every supported offline mutation.
- Allowlisted sync operations only.
- Retry/backoff.
- Conflict state and manual resolution.
- Sync cursor/versioning.
- Offline file manifest.

## Phase 4 — UX/Performance
- Unified task inbox.
- Cross-class calendar.
- Global search.
- Lazy-load class tabs.
- Remove N+1 query patterns.
- Mobile navigation hierarchy.
- Accessibility.
- PWA update prompt.

## Phase 5 — Release
- Production build.
- RLS test matrix.
- Offline transition tests.
- Storage tests.
- Browser/PWA install/update tests.
- Security review.
- Backup/export verification.
