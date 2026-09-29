# Student Hub — Current Feature Freeze

Versi: 1.0.8 Phase 1

## Product rules
- Student-only.
- No lecturer role.
- No create-class client flow.
- No join-class client flow.
- No public member directory.
- No attendance/absensi/presensi feature of any kind.
- Official campus attendance remains outside Student Hub.
- Class mode is exactly `offline` or `online`.
- Four class-wide positions: `ketua`, `wakil_ketua`, `sekretaris`, `bendahara`.

## Role authority
- Ketua: full class leadership.
- Wakil Ketua: leadership and operational class support.
- Sekretaris: announcements, schedules, subjects, materials, documentation, polls, and class administrative notes.
- Bendahara: cash, dues, payment verification, evidence, and financial reporting.
- Member: student-facing information, personal progress, forum, groups, polling participation, notes, and class information.

## Phase 1 hardening completed
- Leadership-only task management.
- Leadership preservation when changing/removing positions.
- Group leader assignment restricted to leadership/current group leader.
- Poll votes cannot be deleted after poll close/deadline.
- Attendance schema guard.
- Active AI documentation no longer contains an attendance workflow.

## Not yet declared production-complete
Full production completion still requires feature-by-feature end-to-end testing against a real Supabase project, browser production build, and offline synchronization tests.
