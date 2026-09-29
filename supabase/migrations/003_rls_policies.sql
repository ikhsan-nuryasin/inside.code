-- 003_rls_policies.sql
-- RLS-first authorization.

-- Enable RLS.
do $$
declare
    tbl text;
begin
    foreach tbl in array array[
        'profiles', 'classes', 'class_members', 'subjects', 'schedules',
        'assignments', 'assignment_checklist_items', 'assignment_progress',
        'checklist_progress', 'files', 'materials', 'material_files',
        'announcements', 'announcement_reads', 'forum_topics', 'forum_posts',
        'forum_post_files', 'groups', 'group_members', 'group_tasks', 'polls',
        'poll_options', 'poll_votes', 'cash_accounts', 'cash_transactions',
        'cash_dues', 'cash_payments', 'personal_notes', 'shared_notes', 'albums',
        'photos', 'notifications', 'activity_logs'
    ] loop
        execute format('alter table public.%I enable row level security', tbl);
    end loop;
end $$;

-- Remove previous policies if rerunning this migration manually.
do $$
declare
    r record;
begin
    for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
        execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;

-- PROFILES
create policy profiles_select_authenticated
on public.profiles for select to authenticated
using (
    id = auth.uid()
    or exists (
        select 1
        from public.class_members cm_me
        join public.class_members cm_target on cm_target.class_id = cm_me.class_id
        where cm_me.user_id = auth.uid()
          and cm_me.status = 'active'
          and cm_target.user_id = profiles.id
          and cm_target.status = 'active'
    )
);

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Profile is normally created by auth trigger; direct insert intentionally not exposed.

-- CLASSES
create policy classes_select_member
on public.classes for select to authenticated
using (public.is_class_member(id));

create policy classes_insert_own
on public.classes for insert to authenticated
with check (created_by = auth.uid());

create policy classes_update_admin
on public.classes for update to authenticated
using (public.is_class_admin(id))
with check (public.is_class_admin(id));

create policy classes_delete_admin
on public.classes for delete to authenticated
using (public.is_class_admin(id));

-- MEMBERS
create policy class_members_select_member
on public.class_members for select to authenticated
using (public.is_class_member(class_id));

-- Direct self-join insert is disabled. Use public.join_class_by_code().
create policy class_members_insert_admin
on public.class_members for insert to authenticated
with check (public.is_class_admin(class_id));

create policy class_members_update_admin
on public.class_members for update to authenticated
using (public.is_class_admin(class_id))
with check (public.is_class_admin(class_id));

create policy class_members_delete_self_or_admin
on public.class_members for delete to authenticated
using (user_id = auth.uid() or public.is_class_admin(class_id));

-- SUBJECTS
create policy subjects_select_member
on public.subjects for select to authenticated
using (public.is_class_member(class_id));

create policy subjects_insert_admin
on public.subjects for insert to authenticated
with check (public.is_class_admin(class_id));

create policy subjects_update_admin
on public.subjects for update to authenticated
using (public.is_class_admin(class_id))
with check (public.is_class_admin(class_id));

create policy subjects_delete_admin
on public.subjects for delete to authenticated
using (public.is_class_admin(class_id));

-- SCHEDULES
create policy schedules_select_member
on public.schedules for select to authenticated
using (public.is_subject_member(subject_id));

create policy schedules_insert_admin
on public.schedules for insert to authenticated
with check (
    public.is_class_admin((select class_id from public.subjects where id = subject_id))
);

create policy schedules_update_admin
on public.schedules for update to authenticated
using (public.is_class_admin((select class_id from public.subjects where id = subject_id)))
with check (public.is_class_admin((select class_id from public.subjects where id = subject_id)));

create policy schedules_delete_admin
on public.schedules for delete to authenticated
using (public.is_class_admin((select class_id from public.subjects where id = subject_id)));

-- ASSIGNMENTS
create policy assignments_select_member
on public.assignments for select to authenticated
using (public.is_class_member(class_id));

create policy assignments_insert_member
on public.assignments for insert to authenticated
with check (created_by = auth.uid() and public.is_class_member(class_id));

create policy assignments_update_creator_or_admin
on public.assignments for update to authenticated
using (created_by = auth.uid() or public.is_class_admin(class_id))
with check (created_by = auth.uid() or public.is_class_admin(class_id));

create policy assignments_delete_creator_or_admin
on public.assignments for delete to authenticated
using (created_by = auth.uid() or public.is_class_admin(class_id));

-- CHECKLIST ITEMS
create policy assignment_checklist_select_member
on public.assignment_checklist_items for select to authenticated
using (public.is_assignment_member(assignment_id));

create policy assignment_checklist_insert_creator_admin
on public.assignment_checklist_items for insert to authenticated
with check (
    exists (
        select 1 from public.assignments a
        where a.id = assignment_id
          and (a.created_by = auth.uid() or public.is_class_admin(a.class_id))
    )
);

create policy assignment_checklist_update_creator_admin
on public.assignment_checklist_items for update to authenticated
using (
    exists (
        select 1 from public.assignments a
        where a.id = assignment_id
          and (a.created_by = auth.uid() or public.is_class_admin(a.class_id))
    )
)
with check (
    exists (
        select 1 from public.assignments a
        where a.id = assignment_id
          and (a.created_by = auth.uid() or public.is_class_admin(a.class_id))
    )
);

create policy assignment_checklist_delete_creator_admin
on public.assignment_checklist_items for delete to authenticated
using (
    exists (
        select 1 from public.assignments a
        where a.id = assignment_id
          and (a.created_by = auth.uid() or public.is_class_admin(a.class_id))
    )
);

-- ASSIGNMENT PROGRESS
create policy assignment_progress_select_member
on public.assignment_progress for select to authenticated
using (public.is_assignment_member(assignment_id));

create policy assignment_progress_insert_own
on public.assignment_progress for insert to authenticated
with check (user_id = auth.uid() and public.is_assignment_member(assignment_id));

create policy assignment_progress_update_own
on public.assignment_progress for update to authenticated
using (user_id = auth.uid() and public.is_assignment_member(assignment_id))
with check (user_id = auth.uid() and public.is_assignment_member(assignment_id));

create policy assignment_progress_delete_own
on public.assignment_progress for delete to authenticated
using (user_id = auth.uid());

-- CHECKLIST PROGRESS
create policy checklist_progress_select_own
on public.checklist_progress for select to authenticated
using (user_id = auth.uid());

create policy checklist_progress_insert_own
on public.checklist_progress for insert to authenticated
with check (
    user_id = auth.uid()
    and exists (
        select 1 from public.assignment_checklist_items ci
        where ci.id = checklist_item_id
          and public.is_assignment_member(ci.assignment_id)
    )
);

create policy checklist_progress_update_own
on public.checklist_progress for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy checklist_progress_delete_own
on public.checklist_progress for delete to authenticated
using (user_id = auth.uid());

-- FILES METADATA
create policy files_select_profile_or_class_member
on public.files for select to authenticated
using (
    (owner_scope = 'profile' and uploaded_by = auth.uid())
    or (owner_scope = 'class' and public.is_class_member(class_id))
);

create policy files_insert_own
on public.files for insert to authenticated
with check (
    uploaded_by = auth.uid()
    and (
        owner_scope = 'profile'
        or (owner_scope = 'class' and public.is_class_member(class_id))
    )
);

create policy files_update_owner_or_admin
on public.files for update to authenticated
using (
    uploaded_by = auth.uid()
    or (owner_scope = 'class' and public.is_class_admin(class_id))
)
with check (
    uploaded_by = auth.uid()
    or (owner_scope = 'class' and public.is_class_admin(class_id))
);

create policy files_delete_owner_or_admin
on public.files for delete to authenticated
using (
    uploaded_by = auth.uid()
    or (owner_scope = 'class' and public.is_class_admin(class_id))
);

-- MATERIALS
create policy materials_select_member
on public.materials for select to authenticated
using (public.is_class_member(class_id));

create policy materials_insert_member
on public.materials for insert to authenticated
with check (created_by = auth.uid() and public.is_class_member(class_id));

create policy materials_update_creator_admin
on public.materials for update to authenticated
using (created_by = auth.uid() or public.is_class_admin(class_id))
with check (created_by = auth.uid() or public.is_class_admin(class_id));

create policy materials_delete_creator_admin
on public.materials for delete to authenticated
using (created_by = auth.uid() or public.is_class_admin(class_id));

create policy material_files_select_member
on public.material_files for select to authenticated
using (public.is_material_member(material_id));

create policy material_files_insert_member
on public.material_files for insert to authenticated
with check (
    public.is_material_member(material_id)
    and exists (
        select 1 from public.files f
        where f.id = file_id
          and (
              (f.owner_scope = 'profile' and f.uploaded_by = auth.uid())
              or (f.owner_scope = 'class' and f.class_id = (select class_id from public.materials where id = material_id))
          )
    )
);

create policy material_files_delete_creator_admin
on public.material_files for delete to authenticated
using (
    exists (
        select 1 from public.materials m
        where m.id = material_id
          and (m.created_by = auth.uid() or public.is_class_admin(m.class_id))
    )
);

-- ANNOUNCEMENTS
create policy announcements_select_member
on public.announcements for select to authenticated
using (public.is_class_member(class_id));

create policy announcements_insert_admin
on public.announcements for insert to authenticated
with check (created_by = auth.uid() and public.is_class_admin(class_id));

create policy announcements_update_admin
on public.announcements for update to authenticated
using (public.is_class_admin(class_id))
with check (public.is_class_admin(class_id));

create policy announcements_delete_admin
on public.announcements for delete to authenticated
using (public.is_class_admin(class_id));

create policy announcement_reads_select_own
on public.announcement_reads for select to authenticated
using (user_id = auth.uid());

create policy announcement_reads_insert_own
on public.announcement_reads for insert to authenticated
with check (
    user_id = auth.uid()
    and exists (
        select 1 from public.announcements a
        where a.id = announcement_id and public.is_class_member(a.class_id)
    )
);

create policy announcement_reads_update_own
on public.announcement_reads for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- FORUM TOPICS
create policy forum_topics_select_member
on public.forum_topics for select to authenticated
using (public.is_class_member(class_id));

create policy forum_topics_insert_member
on public.forum_topics for insert to authenticated
with check (created_by = auth.uid() and public.is_class_member(class_id));

create policy forum_topics_update_creator_or_admin
on public.forum_topics for update to authenticated
using (created_by = auth.uid() or public.is_class_admin(class_id))
with check (created_by = auth.uid() or public.is_class_admin(class_id));

create policy forum_topics_delete_creator_or_admin
on public.forum_topics for delete to authenticated
using (created_by = auth.uid() or public.is_class_admin(class_id));

-- FORUM POSTS
create policy forum_posts_select_member
on public.forum_posts for select to authenticated
using (
    exists (
        select 1 from public.forum_topics t
        where t.id = topic_id and public.is_class_member(t.class_id)
    )
);

create policy forum_posts_insert_member
on public.forum_posts for insert to authenticated
with check (
    user_id = auth.uid()
    and exists (
        select 1 from public.forum_topics t
        where t.id = topic_id and public.is_class_member(t.class_id)
    )
);

create policy forum_posts_update_creator_or_admin
on public.forum_posts for update to authenticated
using (
    user_id = auth.uid()
    or exists (
        select 1 from public.forum_topics t
        where t.id = topic_id and public.is_class_admin(t.class_id)
    )
)
with check (
    user_id = auth.uid()
    or exists (
        select 1 from public.forum_topics t
        where t.id = topic_id and public.is_class_admin(t.class_id)
    )
);

create policy forum_posts_delete_creator_or_admin
on public.forum_posts for delete to authenticated
using (
    user_id = auth.uid()
    or exists (
        select 1 from public.forum_topics t
        where t.id = topic_id and public.is_class_admin(t.class_id)
    )
);

create policy forum_post_files_select_member
on public.forum_post_files for select to authenticated
using (
    exists (
        select 1
        from public.forum_posts p
        join public.forum_topics t on t.id = p.topic_id
        where p.id = post_id and public.is_class_member(t.class_id)
    )
);

create policy forum_post_files_insert_member
on public.forum_post_files for insert to authenticated
with check (
    exists (
        select 1
        from public.forum_posts p
        join public.forum_topics t on t.id = p.topic_id
        where p.id = post_id
          and p.user_id = auth.uid()
          and public.is_class_member(t.class_id)
    )
);

create policy forum_post_files_delete_creator_or_admin
on public.forum_post_files for delete to authenticated
using (
    exists (
        select 1
        from public.forum_posts p
        join public.forum_topics t on t.id = p.topic_id
        where p.id = post_id
          and (p.user_id = auth.uid() or public.is_class_admin(t.class_id))
    )
);

-- GROUPS
create policy groups_select_member
on public.groups for select to authenticated
using (public.is_class_member(class_id));

create policy groups_insert_admin
on public.groups for insert to authenticated
with check (created_by = auth.uid() and public.is_class_admin(class_id));

create policy groups_update_admin
on public.groups for update to authenticated
using (public.is_class_admin(class_id))
with check (public.is_class_admin(class_id));

create policy groups_delete_admin
on public.groups for delete to authenticated
using (public.is_class_admin(class_id));

create policy group_members_select_member
on public.group_members for select to authenticated
using (
    exists (
        select 1 from public.groups g
        where g.id = group_id and public.is_class_member(g.class_id)
    )
);

create policy group_members_insert_admin
on public.group_members for insert to authenticated
with check (
    exists (
        select 1 from public.groups g
        where g.id = group_id and public.is_class_admin(g.class_id)
    )
    and exists (
        select 1
        from public.class_members cm
        where cm.class_id = (select class_id from public.groups where id = group_id)
          and cm.user_id = user_id
          and cm.status = 'active'
    )
);

create policy group_members_delete_admin
on public.group_members for delete to authenticated
using (
    exists (
        select 1 from public.groups g
        where g.id = group_id and public.is_class_admin(g.class_id)
    )
);

create policy group_tasks_select_member
on public.group_tasks for select to authenticated
using (
    exists (
        select 1 from public.groups g
        where g.id = group_id and public.is_class_member(g.class_id)
    )
);

create policy group_tasks_insert_admin
on public.group_tasks for insert to authenticated
with check (
    exists (
        select 1 from public.groups g
        where g.id = group_id and public.is_class_admin(g.class_id)
    )
);

create policy group_tasks_update_admin
on public.group_tasks for update to authenticated
using (exists (select 1 from public.groups g where g.id = group_id and public.is_class_admin(g.class_id)))
with check (exists (select 1 from public.groups g where g.id = group_id and public.is_class_admin(g.class_id)));

create policy group_tasks_delete_admin
on public.group_tasks for delete to authenticated
using (exists (select 1 from public.groups g where g.id = group_id and public.is_class_admin(g.class_id)));

-- POLLS
create policy polls_select_member
on public.polls for select to authenticated
using (public.is_class_member(class_id));

create policy polls_insert_admin
on public.polls for insert to authenticated
with check (created_by = auth.uid() and public.is_class_admin(class_id));

create policy polls_update_admin
on public.polls for update to authenticated
using (public.is_class_admin(class_id))
with check (public.is_class_admin(class_id));

create policy polls_delete_admin
on public.polls for delete to authenticated
using (public.is_class_admin(class_id));

create policy poll_options_select_member
on public.poll_options for select to authenticated
using (exists (select 1 from public.polls p where p.id = poll_id and public.is_class_member(p.class_id)));

create policy poll_options_insert_admin
on public.poll_options for insert to authenticated
with check (exists (select 1 from public.polls p where p.id = poll_id and public.is_class_admin(p.class_id)));

create policy poll_options_update_admin
on public.poll_options for update to authenticated
using (exists (select 1 from public.polls p where p.id = poll_id and public.is_class_admin(p.class_id)))
with check (exists (select 1 from public.polls p where p.id = poll_id and public.is_class_admin(p.class_id)));

create policy poll_options_delete_admin
on public.poll_options for delete to authenticated
using (exists (select 1 from public.polls p where p.id = poll_id and public.is_class_admin(p.class_id)));

create policy poll_votes_select_member
on public.poll_votes for select to authenticated
using (
    user_id = auth.uid()
    or exists (select 1 from public.polls p where p.id = poll_id and public.is_class_member(p.class_id))
);

create policy poll_votes_insert_own
on public.poll_votes for insert to authenticated
with check (
    user_id = auth.uid()
    and exists (
        select 1
        from public.polls p
        join public.poll_options o on o.poll_id = p.id
        where p.id = poll_votes.poll_id
          and o.id = poll_votes.poll_option_id
          and public.is_class_member(p.class_id)
          and p.closed = false
          and (p.closes_at is null or p.closes_at > now())
    )
);

create policy poll_votes_delete_own
on public.poll_votes for delete to authenticated
using (user_id = auth.uid());

-- CASH
create policy cash_accounts_select_member
on public.cash_accounts for select to authenticated
using (public.is_class_member(class_id));

create policy cash_accounts_update_admin
on public.cash_accounts for update to authenticated
using (public.is_class_admin(class_id))
with check (public.is_class_admin(class_id));

create policy cash_transactions_select_member
on public.cash_transactions for select to authenticated
using (
    exists (
        select 1 from public.cash_accounts ca
        where ca.id = cash_account_id and public.is_class_member(ca.class_id)
    )
);

create policy cash_transactions_insert_admin
on public.cash_transactions for insert to authenticated
with check (
    created_by = auth.uid()
    and exists (
        select 1 from public.cash_accounts ca
        where ca.id = cash_account_id and public.is_class_admin(ca.class_id)
    )
);

create policy cash_transactions_update_admin
on public.cash_transactions for update to authenticated
using (
    exists (select 1 from public.cash_accounts ca where ca.id = cash_account_id and public.is_class_admin(ca.class_id))
)
with check (
    exists (select 1 from public.cash_accounts ca where ca.id = cash_account_id and public.is_class_admin(ca.class_id))
);

create policy cash_transactions_delete_admin
on public.cash_transactions for delete to authenticated
using (
    exists (select 1 from public.cash_accounts ca where ca.id = cash_account_id and public.is_class_admin(ca.class_id))
);

create policy cash_dues_select_member
on public.cash_dues for select to authenticated
using (public.is_class_member(class_id));

create policy cash_dues_insert_admin
on public.cash_dues for insert to authenticated
with check (created_by = auth.uid() and public.is_class_admin(class_id));

create policy cash_dues_update_admin
on public.cash_dues for update to authenticated
using (public.is_class_admin(class_id))
with check (public.is_class_admin(class_id));

create policy cash_dues_delete_admin
on public.cash_dues for delete to authenticated
using (public.is_class_admin(class_id));

create policy cash_payments_select_own_or_admin
on public.cash_payments for select to authenticated
using (
    user_id = auth.uid()
    or exists (select 1 from public.cash_dues d where d.id = due_id and public.is_class_admin(d.class_id))
);

create policy cash_payments_insert_own
on public.cash_payments for insert to authenticated
with check (
    user_id = auth.uid()
    and exists (select 1 from public.cash_dues d where d.id = due_id and public.is_class_member(d.class_id))
);

create policy cash_payments_update_own_or_admin
on public.cash_payments for update to authenticated
using (
    user_id = auth.uid()
    or exists (select 1 from public.cash_dues d where d.id = due_id and public.is_class_admin(d.class_id))
)
with check (
    user_id = auth.uid()
    or exists (select 1 from public.cash_dues d where d.id = due_id and public.is_class_admin(d.class_id))
);

create policy cash_payments_delete_own_or_admin
on public.cash_payments for delete to authenticated
using (
    user_id = auth.uid()
    or exists (select 1 from public.cash_dues d where d.id = due_id and public.is_class_admin(d.class_id))
);

-- PERSONAL NOTES
create policy personal_notes_select_own
on public.personal_notes for select to authenticated
using (user_id = auth.uid());

create policy personal_notes_insert_own
on public.personal_notes for insert to authenticated
with check (user_id = auth.uid() and (class_id is null or public.is_class_member(class_id)));

create policy personal_notes_update_own
on public.personal_notes for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and (class_id is null or public.is_class_member(class_id)));

create policy personal_notes_delete_own
on public.personal_notes for delete to authenticated
using (user_id = auth.uid());

-- SHARED NOTES
create policy shared_notes_select_member
on public.shared_notes for select to authenticated
using (public.is_class_member(class_id));

create policy shared_notes_insert_member
on public.shared_notes for insert to authenticated
with check (created_by = auth.uid() and public.is_class_member(class_id));

create policy shared_notes_update_member
on public.shared_notes for update to authenticated
using (public.is_class_member(class_id))
with check (public.is_class_member(class_id));

create policy shared_notes_delete_creator_admin
on public.shared_notes for delete to authenticated
using (created_by = auth.uid() or public.is_class_admin(class_id));

-- ALBUMS / PHOTOS
create policy albums_select_member
on public.albums for select to authenticated
using (public.is_class_member(class_id));

create policy albums_insert_member
on public.albums for insert to authenticated
with check (created_by = auth.uid() and public.is_class_member(class_id));

create policy albums_update_creator_admin
on public.albums for update to authenticated
using (created_by = auth.uid() or public.is_class_admin(class_id))
with check (created_by = auth.uid() or public.is_class_admin(class_id));

create policy albums_delete_creator_admin
on public.albums for delete to authenticated
using (created_by = auth.uid() or public.is_class_admin(class_id));

create policy photos_select_member
on public.photos for select to authenticated
using (
    exists (
        select 1 from public.albums a
        where a.id = album_id and public.is_class_member(a.class_id)
    )
);

create policy photos_insert_member
on public.photos for insert to authenticated
with check (
    uploaded_by = auth.uid()
    and exists (select 1 from public.albums a where a.id = album_id and public.is_class_member(a.class_id))
);

create policy photos_update_creator_admin
on public.photos for update to authenticated
using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.albums a where a.id = album_id and public.is_class_admin(a.class_id))
)
with check (
    uploaded_by = auth.uid()
    or exists (select 1 from public.albums a where a.id = album_id and public.is_class_admin(a.class_id))
);

create policy photos_delete_creator_admin
on public.photos for delete to authenticated
using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.albums a where a.id = album_id and public.is_class_admin(a.class_id))
);

-- NOTIFICATIONS
create policy notifications_select_own
on public.notifications for select to authenticated
using (user_id = auth.uid());

create policy notifications_update_own
on public.notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy notifications_delete_own
on public.notifications for delete to authenticated
using (user_id = auth.uid());

-- ACTIVITY LOGS
create policy activity_logs_select_own_or_class_admin
on public.activity_logs for select to authenticated
using (
    user_id = auth.uid()
    or (class_id is not null and public.is_class_admin(class_id))
);

create policy activity_logs_insert_own
on public.activity_logs for insert to authenticated
with check (user_id = auth.uid());

-- Grants: expose public tables only through authenticated role; RLS controls rows.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
