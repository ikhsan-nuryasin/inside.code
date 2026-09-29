-- Student Hub v1.0.3
-- Security / integrity corrections discovered during audit.

-- ------------------------------------------------------------
-- Do not allow a class to lose its last active admin.
-- ------------------------------------------------------------
create or replace function public.prevent_last_class_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_admins integer;
  target_class uuid;
  removing_active_admin boolean;
begin
  target_class := coalesce(new.class_id, old.class_id);
  removing_active_admin := old.role = 'admin' and old.status = 'active'
    and (tg_op = 'DELETE' or new.role <> 'admin' or new.status <> 'active');

  if not removing_active_admin then
    return coalesce(new, old);
  end if;

  select count(*) into remaining_admins
  from public.class_members
  where class_id = target_class
    and status = 'active'
    and role = 'admin'
    and user_id <> old.user_id;

  if remaining_admins < 1 then
    raise exception 'CLASS_MUST_HAVE_ACTIVE_ADMIN' using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.prevent_last_class_admin_change() from public, anon, authenticated;

drop trigger if exists class_members_prevent_last_admin on public.class_members;
create trigger class_members_prevent_last_admin
before update or delete on public.class_members
for each row execute function public.prevent_last_class_admin_change();

-- ------------------------------------------------------------
-- Rejoining a removed member must be blocked; a former admin
-- returning after leaving comes back as a normal member.
-- ------------------------------------------------------------
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

  select * into v_member
  from public.class_members
  where class_id = v_class.id and user_id = auth.uid();

  if found then
    if v_member.status = 'removed' then
      raise exception using errcode = 'P0001', message = 'CLASS_REJOIN_NOT_ALLOWED';
    end if;

    if v_member.status = 'active' then
      return v_member;
    end if;
  end if;

  insert into public.class_members (class_id, user_id, role, status)
  values (v_class.id, auth.uid(), 'member', 'active')
  on conflict (class_id, user_id)
  do update set role = 'member', status = 'active', updated_at = now();

  select * into v_member
  from public.class_members
  where class_id = v_class.id and user_id = auth.uid();

  return v_member;
end;
$$;

revoke all on function public.join_class_by_code(text) from public, anon;
grant execute on function public.join_class_by_code(text) to authenticated;

-- ------------------------------------------------------------
-- Anonymous polls must not expose voter identities.
-- ------------------------------------------------------------
drop policy if exists poll_votes_select_member on public.poll_votes;
create policy poll_votes_select_member
on public.poll_votes for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.polls p
    where p.id = poll_id
      and public.is_class_member(p.class_id)
      and p.is_anonymous = false
  )
);

-- ------------------------------------------------------------
-- Group tasks: members see their group; assignee may update only
-- completion flag. Admins manage the task itself.
-- ------------------------------------------------------------
drop policy if exists group_tasks_select_member on public.group_tasks;
create policy group_tasks_select_member
on public.group_tasks for select to authenticated
using (
  exists (
    select 1
    from public.groups g
    where g.id = group_id
      and (public.is_class_admin(g.class_id)
           or exists (
              select 1 from public.group_members gm
              where gm.group_id = g.id and gm.user_id = auth.uid()
           ))
  )
);

drop policy if exists group_tasks_update_admin on public.group_tasks;
create policy group_tasks_update_admin
on public.group_tasks for update to authenticated
using (
  exists (select 1 from public.groups g where g.id = group_id and public.is_class_admin(g.class_id))
  or assigned_to = auth.uid()
)
with check (
  exists (select 1 from public.groups g where g.id = group_id and public.is_class_admin(g.class_id))
  or assigned_to = auth.uid()
);

create or replace function public.validate_group_task_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  class_id_value uuid;
begin
  select class_id into class_id_value from public.groups where id = old.group_id;
  if public.is_class_admin(class_id_value) then
    return new;
  end if;

  if old.assigned_to is distinct from auth.uid() then
    raise exception 'NOT_ASSIGNED_TO_CURRENT_USER' using errcode = '42501';
  end if;

  if new.group_id is distinct from old.group_id
     or new.assigned_to is distinct from old.assigned_to
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.deadline is distinct from old.deadline
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'GROUP_TASK_ASSIGNEE_CAN_ONLY_CHANGE_COMPLETION' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists group_tasks_member_update_guard on public.group_tasks;
create trigger group_tasks_member_update_guard
before update on public.group_tasks
for each row execute function public.validate_group_task_member_update();

-- ------------------------------------------------------------
-- Cash payments: members can submit/update proof only. Only an
-- admin may change verification status or paid_at.
-- ------------------------------------------------------------
create or replace function public.validate_cash_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  class_id_value uuid;
  admin boolean := false;
begin
  select class_id into class_id_value
  from public.cash_dues
  where id = new.due_id;

  admin := public.is_class_admin(class_id_value);
  if admin then
    return new;
  end if;

  if new.due_id is distinct from old.due_id
     or new.user_id is distinct from old.user_id
     or new.amount is distinct from old.amount
     or new.status is distinct from old.status
     or new.paid_at is distinct from old.paid_at
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'CASH_PAYMENT_MEMBER_LIMITED_UPDATE' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists cash_payments_member_update_guard on public.cash_payments;
create trigger cash_payments_member_update_guard
before update on public.cash_payments
for each row execute function public.validate_cash_payment_update();

-- ------------------------------------------------------------
-- Activity log insertions must only claim a class the user belongs to.
-- ------------------------------------------------------------
drop policy if exists activity_logs_insert_own on public.activity_logs;
create policy activity_logs_insert_own
on public.activity_logs for insert to authenticated
with check (
  user_id = auth.uid()
  and (class_id is null or public.is_class_member(class_id))
);

-- ------------------------------------------------------------
-- Material/forum attachments must always be class-scoped files.
-- ------------------------------------------------------------
drop policy if exists material_files_insert_member on public.material_files;
create policy material_files_insert_member
on public.material_files for insert to authenticated
with check (
  public.is_material_member(material_id)
  and exists (
    select 1 from public.files f
    where f.id = file_id
      and f.owner_scope = 'class'
      and f.class_id = (select class_id from public.materials where id = material_id)
  )
);

drop policy if exists forum_post_files_insert_member on public.forum_post_files;
create policy forum_post_files_insert_member
on public.forum_post_files for insert to authenticated
with check (
  exists (
    select 1
    from public.forum_posts p
    join public.forum_topics t on t.id = p.topic_id
    join public.files f on f.id = file_id
    where p.id = post_id
      and p.user_id = auth.uid()
      and public.is_class_member(t.class_id)
      and f.owner_scope = 'class'
      and f.class_id = t.class_id
  )
);

-- ------------------------------------------------------------
-- Only class admins may create class-wide assignments.
-- ------------------------------------------------------------
drop policy if exists assignments_insert_member on public.assignments;
drop policy if exists assignments_insert_admin on public.assignments;
create policy assignments_insert_admin
on public.assignments for insert to authenticated
with check (created_by = auth.uid() and public.is_class_admin(class_id));

-- Members may remove their own payment only while it is still pending.
drop policy if exists cash_payments_delete_own_or_admin on public.cash_payments;
create policy cash_payments_delete_own_or_admin
on public.cash_payments for delete to authenticated
using (
  (user_id = auth.uid() and status = 'pending')
  or exists (select 1 from public.cash_dues d where d.id = due_id and public.is_class_admin(d.class_id))
);


-- A new member payment must start as pending; only admins can verify it.
drop policy if exists cash_payments_insert_own on public.cash_payments;
create policy cash_payments_insert_own
on public.cash_payments for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and paid_at is null
  and exists (select 1 from public.cash_dues d where d.id = due_id and public.is_class_member(d.class_id))
);
