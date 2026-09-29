# Student Hub v1.0.8 — Phase 1 Audit & Fixes

## Purpose
This phase hardens authorization and data integrity before feature-completion work.

## Verified product constraints
- Student-only.
- No lecturer.
- No create class client flow.
- No join class client flow.
- No public member directory.
- No attendance, absensi, or presensi feature.
- Class mode is only offline or online.

## Fixes
1. Leadership-only class task mutations.
2. Checklist management is leadership-only.
3. Last leadership position cannot be removed/demoted.
4. Group leader can be assigned only by class leadership or the current group leader.
5. Poll vote deletion is blocked after closing/deadline.
6. Attendance schema is guarded as absent in the final database.
7. Shared notes direct UPDATE path is removed in favor of version RPC.
8. File identity is protected by trigger.
9. Group panel member-management UI works for both class leadership and the current group leader.
10. Dashboard computes the next schedule relative to current weekday/time and sorts announcements globally by publication time.
11. PWA service worker cache is versioned to 1.0.8.

## Important validation limitation
A static source audit is not a substitute for installing dependencies and running a real production build against a real Supabase project. Run `npm install`, `npm run typecheck`, `npm run build`, and then end-to-end tests locally.
