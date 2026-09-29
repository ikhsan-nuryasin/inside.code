-- Student Hub v1.0.4 notification automation.
-- Creates in-app notifications for class assignments, announcements and forum replies.
-- All work is server-side so clients cannot spoof recipients.

create or replace function private.notify_class_members(
  p_class_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb,
  p_exclude_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.notifications(user_id, notification_type, title, body, data)
  select cm.user_id, p_type, left(p_title,200), coalesce(p_body,''), coalesce(p_data,'{}'::jsonb)
  from public.class_members cm
  where cm.class_id = p_class_id
    and cm.status = 'active'
    and (p_exclude_user is null or cm.user_id <> p_exclude_user);
end;
$$;
revoke all on function private.notify_class_members(uuid, public.notification_type, text, text, jsonb, uuid) from public, anon, authenticated;

create or replace function public.notify_assignment_created()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.notify_class_members(
    new.class_id,
    'assignment',
    'Tugas baru: ' || new.title,
    case when new.deadline is null then 'Tugas baru telah ditambahkan ke kelas.' else 'Deadline: ' || to_char(new.deadline at time zone 'Asia/Jakarta','DD Mon YYYY HH24:MI') end,
    jsonb_build_object('assignment_id',new.id,'class_id',new.class_id),
    new.created_by
  );
  return new;
end;
$$;
revoke all on function public.notify_assignment_created() from public, anon, authenticated;
drop trigger if exists assignments_notify_created on public.assignments;
create trigger assignments_notify_created after insert on public.assignments for each row execute function public.notify_assignment_created();

create or replace function public.notify_announcement_created()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.notify_class_members(new.class_id,'announcement',new.title,new.content,jsonb_build_object('announcement_id',new.id,'class_id',new.class_id),new.created_by);
  return new;
end;
$$;
revoke all on function public.notify_announcement_created() from public, anon, authenticated;
drop trigger if exists announcements_notify_created on public.announcements;
create trigger announcements_notify_created after insert on public.announcements for each row execute function public.notify_announcement_created();

create or replace function public.notify_forum_reply()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_class_id uuid;
  v_topic_title text;
begin
  select t.class_id,t.title into v_class_id,v_topic_title
  from public.forum_topics t where t.id = new.topic_id;
  if new.parent_id is not null then
    insert into public.notifications(user_id,notification_type,title,body,data)
    select p.user_id,'forum','Balasan forum: ' || v_topic_title,left(new.content,300),jsonb_build_object('topic_id',new.topic_id,'post_id',new.id)
    from public.forum_posts p
    where p.id = new.parent_id
      and p.user_id <> new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function public.notify_forum_reply() from public, anon, authenticated;
drop trigger if exists forum_posts_notify_reply on public.forum_posts;
create trigger forum_posts_notify_reply after insert on public.forum_posts for each row execute function public.notify_forum_reply();
