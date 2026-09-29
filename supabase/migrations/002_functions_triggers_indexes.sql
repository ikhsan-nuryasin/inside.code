-- 002_functions_triggers_indexes.sql
-- Student Hub
-- Functions are split between a non-exposed private schema and safe public RPCs.

create schema if not exists private;

-- ============================================================
-- Generic updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Attach updated_at triggers.
do $$
declare
    tbl text;
begin
    foreach tbl in array array[
        'profiles', 'classes', 'class_members', 'subjects', 'schedules',
        'assignments', 'assignment_checklist_items', 'assignment_progress',
        'checklist_progress', 'materials', 'announcements', 'forum_topics',
        'forum_posts', 'groups', 'group_tasks', 'polls', 'cash_accounts',
        'cash_transactions', 'cash_dues', 'cash_payments', 'personal_notes',
        'shared_notes', 'albums'
    ] loop
        execute format('drop trigger if exists trg_%I_updated_at on public.%I', tbl, tbl);
        execute format(
            'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
            tbl, tbl
        );
    end loop;
end $$;

-- ============================================================
-- Auth profile trigger
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', '')
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- Private authorization helpers
-- ============================================================
create or replace function private.is_class_member(p_class_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
    select exists (
        select 1
        from public.class_members cm
        where cm.class_id = p_class_id
          and cm.user_id = coalesce(p_user_id, auth.uid())
          and cm.status = 'active'
    );
$$;

create or replace function private.is_class_admin(p_class_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
    select exists (
        select 1
        from public.class_members cm
        where cm.class_id = p_class_id
          and cm.user_id = coalesce(p_user_id, auth.uid())
          and cm.status = 'active'
          and cm.role = 'admin'
    );
$$;

create or replace function private.is_subject_member(p_subject_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
    select exists (
        select 1
        from public.subjects s
        where s.id = p_subject_id
          and private.is_class_member(s.class_id, coalesce(p_user_id, auth.uid()))
    );
$$;

create or replace function private.is_assignment_member(p_assignment_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
    select exists (
        select 1
        from public.assignments a
        where a.id = p_assignment_id
          and private.is_class_member(a.class_id, coalesce(p_user_id, auth.uid()))
    );
$$;

create or replace function private.is_material_member(p_material_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
    select exists (
        select 1
        from public.materials m
        where m.id = p_material_id
          and private.is_class_member(m.class_id, coalesce(p_user_id, auth.uid()))
    );
$$;

revoke all on schema private from public;
revoke all on all functions in schema private from public, anon, authenticated;



-- Safe public wrappers use auth.uid() only. These are needed by RLS/Storage policies.
create or replace function public.is_class_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
    select private.is_class_member(p_class_id, auth.uid());
$$;

create or replace function public.is_class_admin(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
    select private.is_class_admin(p_class_id, auth.uid());
$$;

create or replace function public.is_subject_member(p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
    select private.is_subject_member(p_subject_id, auth.uid());
$$;

create or replace function public.is_assignment_member(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
    select private.is_assignment_member(p_assignment_id, auth.uid());
$$;

create or replace function public.is_material_member(p_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
    select private.is_material_member(p_material_id, auth.uid());
$$;

create or replace function public.is_class_member_from_text(p_class_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
    return private.is_class_member_from_text(p_class_id, auth.uid());
end;
$$;

create or replace function public.is_class_admin_from_text(p_class_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
    return private.is_class_admin_from_text(p_class_id, auth.uid());
end;
$$;

revoke all on function public.is_class_member(uuid) from public, anon;
revoke all on function public.is_class_admin(uuid) from public, anon;
revoke all on function public.is_subject_member(uuid) from public, anon;
revoke all on function public.is_assignment_member(uuid) from public, anon;
revoke all on function public.is_material_member(uuid) from public, anon;
revoke all on function public.is_class_member_from_text(text) from public, anon;
revoke all on function public.is_class_admin_from_text(text) from public, anon;
grant execute on function public.is_class_member(uuid) to authenticated;
grant execute on function public.is_class_admin(uuid) to authenticated;
grant execute on function public.is_subject_member(uuid) to authenticated;
grant execute on function public.is_assignment_member(uuid) to authenticated;
grant execute on function public.is_material_member(uuid) to authenticated;
grant execute on function public.is_class_member_from_text(text) to authenticated;
grant execute on function public.is_class_admin_from_text(text) to authenticated;

-- ============================================================
-- Class code generation
-- ============================================================
create or replace function private.random_class_code(p_length integer default 10)
returns text
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
    chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result text := '';
    i integer;
begin
    if p_length < 6 or p_length > 32 then
        raise exception 'Invalid class code length';
    end if;

    for i in 1..p_length loop
        result := result || substr(chars, 1 + floor(random() * length(chars))::integer, 1);
    end loop;

    return result;
end;
$$;

revoke all on function private.random_class_code(integer) from public, anon, authenticated;

-- Storage path-safe helpers. Invalid UUID paths return false instead of aborting the policy.
create or replace function private.is_class_member_from_text(p_class_id text, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
    v_class_id uuid;
begin
    begin
        v_class_id := p_class_id::uuid;
    exception when others then
        return false;
    end;
    return private.is_class_member(v_class_id, coalesce(p_user_id, auth.uid()));
end;
$$;

create or replace function private.is_class_admin_from_text(p_class_id text, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
    v_class_id uuid;
begin
    begin
        v_class_id := p_class_id::uuid;
    exception when others then
        return false;
    end;
    return private.is_class_admin(v_class_id, coalesce(p_user_id, auth.uid()));
end;
$$;

revoke all on function private.is_class_member_from_text(text, uuid) from public, anon, authenticated;
revoke all on function private.is_class_admin_from_text(text, uuid) from public, anon, authenticated;


-- ============================================================
-- Safe class creation RPC
-- Client should prefer this function instead of direct insert.
-- ============================================================
create or replace function public.create_class(
    p_name text,
    p_study_program text default null,
    p_semester integer default null,
    p_academic_year text default null,
    p_description text default null
)
returns public.classes
language plpgsql
security invoker
set search_path = public, private
as $$
declare
    v_code text;
    v_class public.classes;
    attempts integer := 0;
begin
    if auth.uid() is null then
        raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
    end if;

    if length(trim(coalesce(p_name, ''))) = 0 then
        raise exception using errcode = 'P0001', message = 'CLASS_NAME_REQUIRED';
    end if;

    if p_semester is not null and (p_semester < 1 or p_semester > 20) then
        raise exception using errcode = 'P0001', message = 'INVALID_SEMESTER';
    end if;

    loop
        attempts := attempts + 1;
        v_code := private.random_class_code(10);

        begin
            insert into public.classes (
                name, class_code, study_program, semester, academic_year, description, created_by
            )
            values (
                trim(p_name), v_code, nullif(trim(p_study_program), ''), p_semester,
                nullif(trim(p_academic_year), ''), nullif(trim(p_description), ''), auth.uid()
            )
            returning * into v_class;
            exit;
        exception
            when unique_violation then
                if attempts >= 10 then
                    raise exception using errcode = 'P0001', message = 'CLASS_CODE_GENERATION_FAILED';
                end if;
        end;
    end loop;

    return v_class;
end;
$$;

revoke all on function public.create_class(text, text, integer, text, text) from public, anon;
grant execute on function public.create_class(text, text, integer, text, text) to authenticated;

-- ============================================================
-- Join class by code.
-- This prevents arbitrary joining by class UUID.
-- ============================================================
create or replace function public.join_class_by_code(p_class_code text)
returns public.class_members
language plpgsql
security definer
set search_path = public, private
as $$
declare
    v_class public.classes;
    v_member public.class_members;
begin
    if auth.uid() is null then
        raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
    end if;

    select * into v_class
    from public.classes
    where class_code = upper(trim(p_class_code))
      and deleted_at is null
    limit 1;

    if not found then
        raise exception using errcode = 'P0001', message = 'CLASS_NOT_FOUND';
    end if;

    insert into public.class_members (class_id, user_id, role, status)
    values (v_class.id, auth.uid(), 'member', 'active')
    on conflict (class_id, user_id)
    do update set status = 'active';

    select * into v_member
    from public.class_members
    where class_id = v_class.id and user_id = auth.uid();

    return v_member;
end;
$$;

revoke all on function public.join_class_by_code(text) from public, anon;
grant execute on function public.join_class_by_code(text) to authenticated;

-- ============================================================
-- Class creator trigger
-- ============================================================
create or replace function public.handle_new_class()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.class_members (class_id, user_id, role, status)
    values (new.id, new.created_by, 'admin', 'active')
    on conflict (class_id, user_id)
    do update set role = 'admin', status = 'active';

    insert into public.cash_accounts (class_id)
    values (new.id)
    on conflict (class_id) do nothing;

    return new;
end;
$$;

revoke all on function public.handle_new_class() from public, anon, authenticated;

drop trigger if exists trg_class_created on public.classes;
create trigger trg_class_created
after insert on public.classes
for each row execute function public.handle_new_class();

-- ============================================================
-- Helpful indexes
-- ============================================================
create index if not exists idx_class_members_user on public.class_members(user_id);
create index if not exists idx_class_members_class on public.class_members(class_id);
create index if not exists idx_class_members_role on public.class_members(class_id, role) where status = 'active';
create index if not exists idx_classes_created_by on public.classes(created_by);
create index if not exists idx_subjects_class on public.subjects(class_id);
create index if not exists idx_schedules_subject on public.schedules(subject_id);
create index if not exists idx_assignments_class_deadline on public.assignments(class_id, deadline);
create index if not exists idx_assignment_progress_user on public.assignment_progress(user_id);
create index if not exists idx_materials_class on public.materials(class_id);
create index if not exists idx_files_class on public.files(class_id);
create index if not exists idx_announcements_class_published on public.announcements(class_id, published_at desc);
create index if not exists idx_forum_topics_class_updated on public.forum_topics(class_id, updated_at desc);
create index if not exists idx_forum_posts_topic_created on public.forum_posts(topic_id, created_at);
create index if not exists idx_groups_class on public.groups(class_id);
create index if not exists idx_group_members_user on public.group_members(user_id);
create index if not exists idx_group_tasks_group_deadline on public.group_tasks(group_id, deadline);
create index if not exists idx_polls_class on public.polls(class_id, created_at desc);
create index if not exists idx_poll_votes_poll on public.poll_votes(poll_id);
create index if not exists idx_cash_transactions_account_date on public.cash_transactions(cash_account_id, transaction_date desc);
create index if not exists idx_cash_dues_class on public.cash_dues(class_id, due_date);
create index if not exists idx_cash_payments_user on public.cash_payments(user_id);
create index if not exists idx_personal_notes_user_updated on public.personal_notes(user_id, updated_at desc);
create index if not exists idx_shared_notes_class on public.shared_notes(class_id, updated_at desc);
create index if not exists idx_albums_class on public.albums(class_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_activity_logs_class_created on public.activity_logs(class_id, created_at desc);
