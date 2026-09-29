# Student Hub v1.0.8 — AI Implementation Context

IMPORTANT: This file and `docs/00_CURRENT_SOURCE_OF_TRUTH.md` override older v1.0.0-v1.0.5 notes when they conflict.

## Goal

Build and maintain a student-only class management PWA for small classes (initially fewer than 25 students per class).

## Stack

React + TypeScript + Vite + PWA + IndexedDB + Supabase.

Do NOT add Flutter, Laravel, local MySQL, Google Sheets, or Google Drive.

## Product boundaries

- No lecturer accounts.
- No attendance feature.
- Official campus attendance is outside this product.
- No create-class client feature.
- No join-class client feature.
- No public member directory.
- Class delivery mode is exactly `offline` or `online`.

## Provisioning

Classes and memberships are provisioned outside the normal student client. Authenticated students do not receive execution rights for class creation/join RPCs.

## Class positions

Positions:
- `ketua`
- `wakil_ketua`
- `sekretaris`
- `bendahara`

Exactly one student per position per class and one class-wide position per student.

### Leadership: Ketua/Wakil

- class settings
- class tasks
- groups
- officer assignments
- secretary features
- documentation
- polls
- cash

### Secretary

- announcements
- subjects and schedules
- schedule template
- materials
- documentation
- polls
- shared administrative notes where permitted

### Treasurer

- cash
- dues
- payments
- payment verification
- financial records

### Member

- view/use student features
- personal task progress
- personal notes
- read materials/announcements
- forum participation
- poll voting
- group participation
- view class financial information
- pay dues

## Group leader

Group leader is separate from class-wide positions. Selection methods:
- random wheel;
- manual selection.

Server validates active group membership.

## Documentation

Top-level module. Album creation/management is controlled by secretary/leadership. Photo upload is available to class members subject to Storage RLS.

## Cash

Top-level module. Treasurer/leadership manage transactions and dues. Normal members can view and submit their own payment.

## Offline

Supabase PostgreSQL is authoritative. IndexedDB is local client state. Mutations that support offline operation go to the sync queue. File uploads require online connectivity.

A failed/conflict mutation MUST remain in the queue. Do not delete queue items on validation, RLS, unique constraint, version, or conflict errors. Retry transient/network errors with backoff.

## Security

RLS is the authorization boundary. Client checks are UX only. Never expose a secret/service-role key. Prefer validated RPCs for sensitive workflows.

## Schedule

The official source schedule is `docs/assets/jadwal-matakuliah-sumber.png`. The template contains the 8 supplied subjects for Monday-Thursday. Both leadership and secretary can apply the template.

## UX

- Mobile-first.
- No giant member directory.
- Group features by learning/community/class administration.
- Every page needs loading, empty, error, offline, and syncing states.
- Explain data freshness when offline.

## Never regress

Do not reintroduce:
- create class;
- join class;
- public member list;
- lecturer role;
- campus official attendance;
- Google Sheets;
- Google Drive;
- Flutter.

## Implementation note
Use `docs/00_CURRENT_SOURCE_OF_TRUTH.md` before editing existing code. Preserve the existing migration order and create a new numbered migration for database changes.
