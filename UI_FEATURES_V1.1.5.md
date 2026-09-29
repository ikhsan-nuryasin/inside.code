# Student Hub v1.1.5 — Randomizer & Notification Popup

## Added
- Randomizer kelas with three visible modes: Ketua Kelompok, Urutan Presentasi, Random Anggota.
- Presentation order mode removes the selected group from the wheel after each spin and numbers the final order.
- Randomizer result history stored in Supabase table `randomizer_results` for authenticated class members; leadership can save/delete history.
- Group leader mode uses existing group membership and `set_group_leader` RPC.
- Global notification popup: latest unread notification is shown as a popup; realtime INSERT notifications are shown automatically, auto-dismiss after 6.5 seconds, and can open the full notification history.
- Mobile UI follows the supplied blue/white reference style.

## Existing retained features
All v1.1.4 feature groups remain: auth/profile, dashboard, classes, tasks/checklists, schedule/subjects, materials/attachments, announcements, forum/reporting, groups/member/task management, polling, cash/payment/proof/verification/audit, documentation, notes/shared notes, secretary administration, offline queue/sync, PWA, search, settings, and mobile navigation.

## Product rules retained
- No attendance/absensi/presence module.
- No lecturer role.
- No client-side class creation.
- No client-side class join flow.
