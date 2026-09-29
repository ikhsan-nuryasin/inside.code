# Student Hub v1.1.4 — Full Feature Audit

## User-facing modules

- Authentication: login, register, password reset, update password
- Dashboard: active class, nearest tasks, next schedule, announcements, activity, quick access
- Classes: class list and class workspace
- Class workspace: overview, tasks, schedule/subjects, materials, announcements, forum, groups, polls, files, shared notes, secretary administration
- Tasks: create/edit/delete, deadline, priority, subject, checklist CRUD, personal progress, attachment
- Schedule/subjects: create/edit/delete schedule, subject metadata, online/offline mode, template application
- Materials: create/edit/delete, link, description, attachment
- Announcements: create/edit/archive/pin/read-state
- Forum: topic/post CRUD, replies, report topic/post, moderation workflow
- Groups: group CRUD, member add/remove, group tasks, task edit/delete/complete, leader wheel/manual
- Polls: create, description, anonymous flag, close, vote, result counts
- Cash: balance, income, expense, ledger, dues, payment, proof upload, verification, rejection/partial status, void, correction/audit trail
- Documentation: album CRUD, photo upload/edit/delete
- Notes: personal notes and versioned shared notes
- Secretary administration: notulen, agenda, keputusan, administratif
- Positions: class officer assignment/removal
- Notifications: notification list and read state
- Search: class/task/material/announcement/forum/shared-note search
- Settings: profile, offline data, sync/outbox, cache, local-data controls, app update/about

## Non-features intentionally preserved

- No attendance / absensi / presensi module
- No lecturer account/module
- No create-class flow
- No join-class flow
- No general member directory

## Offline

Read caching, supported mutation outbox, retry/backoff, conflict state, cursor-based sync, and offline file cache remain enabled. New binary uploads still require network access to Supabase Storage.
