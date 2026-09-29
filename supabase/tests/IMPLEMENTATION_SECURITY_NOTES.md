# Implementation Security Notes

1. Verify every public table has RLS enabled.
2. Verify no frontend bundle contains `service_role` or a secret key.
3. Verify class-scoped reads require active membership.
4. Verify class-admin writes require `role='admin'` on active membership.
5. Verify personal notes are owner-only.
6. Verify file Storage buckets are private.
7. Verify Storage ownership uses `owner_id`, not deprecated `owner`.
8. Verify join class can only happen using `join_class_by_code`.
9. Verify poll votes have one-row-per-poll-per-user constraint.
10. Verify cash transaction deletion/update cannot be performed by ordinary members.
