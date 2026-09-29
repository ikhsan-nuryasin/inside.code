# Student Hub v1.0.6 — Release Audit

## Requirement audit

### Removed
- Create class: removed from application UI and normal authenticated RPC execution.
- Join class: removed from application UI and normal authenticated RPC execution.
- Class member directory: removed from Class Workspace navigation/UI.

### Added
- Internal class attendance.
- Separate class documentation module.
- Separate class cash module.
- Class officer roles.
- Role-based capability checks.
- Group leader wheel/random selection.
- Manual group leader selection.
- Server validation for group leaders.
- Attendance sessions initialize active members as absent.

## Officer matrix

Ketua/Wakil:
- leadership
- class settings
- class tasks
- groups
- officer assignment
- secretary features
- attendance
- documentation
- polls
- cash

Sekretaris:
- announcements
- subjects
- schedules
- schedule template
- materials
- attendance
- documentation
- polls

Bendahara:
- cash account
- income/expense
- dues
- payment verification
- financial records

Anggota:
- learning/community features
- own progress/notes
- own attendance status
- own dues/payment

## Schedule source

The schedule template is the timetable supplied by the user. It contains 8 subjects Monday through Thursday. Source image is stored at `docs/assets/jadwal-matakuliah-sumber.png`.

## Security audit updates

- Position writes are RPC-only.
- Class create/join functions are execution-revoked for authenticated clients.
- Shared notes direct update for members is removed; version RPC is the write path.
- File identity fields are protected by trigger.
- Audit log browser inserts are revoked.
- Leadership is based on class position instead of legacy `class_members.role='admin'`.
- Attendance marking is officer-managed.
- Cash payment verification remains officer-controlled.

## Offline audit

The client has IndexedDB cache and an offline mutation queue. Failed/non-transient and conflict mutations are retained in the queue rather than silently deleted. Network/transient failures use retry delay/backoff.

The current release still does not claim complete offline mutation support for binary uploads or every class-admin mutation. File uploads require connectivity. This must remain explicit in UX and documentation.

## Build verification

Source-level TS/TSX transpile parsing was run against the current source tree with zero parse failures. Full dependency installation and production Vite build were not reproducible in the audit environment because npm registry dependency downloads timed out. Run `npm install`, `npm run typecheck`, and `npm run build` on the development machine before deployment.
