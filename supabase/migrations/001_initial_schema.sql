-- Student Hub v1
-- 001_initial_schema.sql
-- Initial PostgreSQL schema for Supabase.
-- Execute before 002_functions_triggers_indexes.sql, 003_rls_policies.sql,
-- 004_storage_policies.sql, and later migrations.

create extension if not exists pgcrypto;

create schema if not exists private;

-- =========================
-- ENUM TYPES
-- =========================

create type public.class_member_role as enum ('member', 'admin');
create type public.class_member_status as enum ('active', 'invited', 'left', 'removed');
create type public.assignment_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.assignment_progress_status as enum ('not_started', 'in_progress', 'completed');
create type public.file_owner_scope as enum ('profile', 'class');
create type public.material_type as enum ('document', 'presentation', 'spreadsheet', 'archive', 'image', 'video', 'link', 'other');
create type public.forum_category as enum ('general', 'question', 'task', 'material', 'announcement', 'random');
create type public.cash_transaction_type as enum ('income', 'expense');
create type public.cash_payment_status as enum ('pending', 'paid', 'rejected', 'partial');
create type public.notification_type as enum ('announcement', 'assignment', 'forum', 'group', 'poll', 'cash', 'system');

-- =========================
-- HELPER TRIGGER FUNCTION
-- =========================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- PROFILES
-- =========================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 150),
  nim text check (nim is null or char_length(trim(nim)) between 1 and 50),
  major text check (major is null or char_length(trim(major)) between 1 and 150),
  semester integer check (semester is null or semester between 1 and 20),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_nim_idx on public.profiles (nim);
create index profiles_name_idx on public.profiles using gin (to_tsvector('simple', full_name));

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- =========================
-- CLASSES
-- =========================

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 150),
  class_code text not null unique check (class_code ~ '^[A-Z0-9]{6,16}$'),
  study_program text,
  semester integer check (semester is null or semester between 1 and 20),
  academic_year text,
  description text,
  cover_path text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index classes_created_by_idx on public.classes (created_by);
create index classes_semester_idx on public.classes (semester);
create index classes_active_idx on public.classes (id) where deleted_at is null;

create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

-- =========================
-- CLASS MEMBERS
-- =========================

create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.class_member_role not null default 'member',
  status public.class_member_status not null default 'active',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, user_id)
);

create index class_members_user_idx on public.class_members (user_id);
create index class_members_class_status_idx on public.class_members (class_id, status);
create index class_members_class_role_idx on public.class_members (class_id, role);

create trigger class_members_set_updated_at
before update on public.class_members
for each row execute function public.set_updated_at();

-- =========================
-- SUBJECTS / SCHEDULES
-- =========================

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 150),
  code text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index subjects_class_idx on public.subjects (class_id);
create index subjects_active_idx on public.subjects (class_id) where deleted_at is null;

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  room text,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at > starts_at)
);

create index schedules_subject_idx on public.schedules (subject_id);
create index schedules_day_idx on public.schedules (day_of_week, starts_at);

create trigger schedules_set_updated_at
before update on public.schedules
for each row execute function public.set_updated_at();

-- =========================
-- ASSIGNMENTS
-- =========================

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  deadline timestamptz,
  priority public.assignment_priority not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index assignments_class_idx on public.assignments (class_id);
create index assignments_subject_idx on public.assignments (subject_id);
create index assignments_deadline_idx on public.assignments (deadline) where deleted_at is null;

create trigger assignments_set_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();

create table public.assignment_checklist_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 300),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index assignment_checklist_assignment_idx on public.assignment_checklist_items (assignment_id, sort_order);

create trigger assignment_checklist_items_set_updated_at
before update on public.assignment_checklist_items
for each row execute function public.set_updated_at();

create table public.assignment_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.assignment_progress_status not null default 'not_started',
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create index assignment_progress_user_idx on public.assignment_progress (user_id, updated_at desc);
create index assignment_progress_assignment_idx on public.assignment_progress (assignment_id);

create table public.checklist_progress (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid not null references public.assignment_checklist_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (checklist_item_id, user_id)
);

create index checklist_progress_user_idx on public.checklist_progress (user_id, updated_at desc);
create index checklist_progress_item_idx on public.checklist_progress (checklist_item_id);

-- =========================
-- FILES / MATERIALS
-- =========================

create table public.files (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  owner_scope public.file_owner_scope not null,
  class_id uuid references public.classes(id) on delete cascade,
  bucket text not null,
  storage_path text not null unique,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  mime_type text not null check (char_length(trim(mime_type)) between 1 and 150),
  file_size bigint not null check (file_size >= 0),
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((owner_scope = 'profile' and class_id is null) or (owner_scope = 'class' and class_id is not null))
);

create index files_uploaded_by_idx on public.files (uploaded_by);
create index files_class_idx on public.files (class_id);
create index files_bucket_idx on public.files (bucket);
create index files_active_class_idx on public.files (class_id) where deleted_at is null;

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  material_type public.material_type not null default 'document',
  external_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((material_type = 'link' and external_url is not null) or material_type <> 'link')
);

create index materials_class_idx on public.materials (class_id);
create index materials_subject_idx on public.materials (subject_id);
create index materials_active_idx on public.materials (class_id) where deleted_at is null;

create trigger materials_set_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

create table public.material_files (
  material_id uuid not null references public.materials(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (material_id, file_id)
);

create index material_files_file_idx on public.material_files (file_id);

-- =========================
-- ANNOUNCEMENTS
-- =========================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  content text not null,
  priority smallint not null default 1 check (priority between 0 and 3),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index announcements_class_published_idx on public.announcements (class_id, published_at desc) where deleted_at is null;

create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

create table public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index announcement_reads_user_idx on public.announcement_reads (user_id, read_at desc);

-- =========================
-- FORUM
-- =========================

create table public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  category public.forum_category not null default 'general',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index forum_topics_class_pinned_created_idx on public.forum_topics (class_id, pinned desc, created_at desc) where deleted_at is null;

create trigger forum_topics_set_updated_at
before update on public.forum_topics
for each row execute function public.set_updated_at();

create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  parent_id uuid references public.forum_posts(id) on delete set null,
  content text not null check (char_length(trim(content)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index forum_posts_topic_created_idx on public.forum_posts (topic_id, created_at asc) where deleted_at is null;
create index forum_posts_user_idx on public.forum_posts (user_id);

create trigger forum_posts_set_updated_at
before update on public.forum_posts
for each row execute function public.set_updated_at();

create table public.forum_post_files (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  primary key (post_id, file_id)
);

create index forum_post_files_file_idx on public.forum_post_files (file_id);

-- =========================
-- GROUPS
-- =========================

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index groups_class_idx on public.groups (class_id) where deleted_at is null;

create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);
create index group_members_group_idx on public.group_members (group_id);

create table public.group_tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  completed boolean not null default false,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index group_tasks_group_idx on public.group_tasks (group_id, deadline) where deleted_at is null;
create index group_tasks_assignee_idx on public.group_tasks (assigned_to);

create trigger group_tasks_set_updated_at
before update on public.group_tasks
for each row execute function public.set_updated_at();

-- =========================
-- POLLS
-- =========================

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  closes_at timestamptz,
  is_anonymous boolean not null default false,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index polls_class_idx on public.polls (class_id, created_at desc) where deleted_at is null;
create index polls_open_idx on public.polls (closes_at) where closed = false and deleted_at is null;

create trigger polls_set_updated_at
before update on public.polls
for each row execute function public.set_updated_at();

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 200),
  sort_order integer not null default 0,
  unique (poll_id, label)
);

create index poll_options_poll_idx on public.poll_options (poll_id, sort_order);

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  poll_option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);

create index poll_votes_user_idx on public.poll_votes (user_id);
create index poll_votes_option_idx on public.poll_votes (poll_option_id);

-- =========================
-- CLASS CASH
-- =========================

create table public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null unique references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  cash_account_id uuid not null references public.cash_accounts(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  transaction_type public.cash_transaction_type not null,
  amount numeric(14,2) not null check (amount > 0),
  category text not null check (char_length(trim(category)) between 1 and 120),
  description text,
  proof_file_id uuid references public.files(id) on delete set null,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index cash_transactions_account_date_idx on public.cash_transactions (cash_account_id, transaction_date desc, created_at desc) where deleted_at is null;
create index cash_transactions_creator_idx on public.cash_transactions (created_by);

create trigger cash_accounts_set_updated_at
before update on public.cash_accounts
for each row execute function public.set_updated_at();

create trigger cash_transactions_set_updated_at
before update on public.cash_transactions
for each row execute function public.set_updated_at();

create table public.cash_dues (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  amount numeric(14,2) not null check (amount > 0),
  due_date date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index cash_dues_class_idx on public.cash_dues (class_id, due_date) where deleted_at is null;

create trigger cash_dues_set_updated_at
before update on public.cash_dues
for each row execute function public.set_updated_at();

create table public.cash_payments (
  id uuid primary key default gen_random_uuid(),
  due_id uuid not null references public.cash_dues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  status public.cash_payment_status not null default 'pending',
  proof_file_id uuid references public.files(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (due_id, user_id)
);

create index cash_payments_user_idx on public.cash_payments (user_id, created_at desc);
create index cash_payments_due_idx on public.cash_payments (due_id, status);

create trigger cash_payments_set_updated_at
before update on public.cash_payments
for each row execute function public.set_updated_at();

-- =========================
-- NOTES
-- =========================

create table public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  content text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index personal_notes_user_updated_idx on public.personal_notes (user_id, updated_at desc) where deleted_at is null;
create index personal_notes_class_idx on public.personal_notes (class_id) where deleted_at is null;

create trigger personal_notes_set_updated_at
before update on public.personal_notes
for each row execute function public.set_updated_at();

create table public.shared_notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  content text not null default '',
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index shared_notes_class_updated_idx on public.shared_notes (class_id, updated_at desc) where deleted_at is null;

create trigger shared_notes_set_updated_at
before update on public.shared_notes
for each row execute function public.set_updated_at();

-- =========================
-- ALBUMS / PHOTOS
-- =========================

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index albums_class_idx on public.albums (class_id, created_at desc) where deleted_at is null;

create trigger albums_set_updated_at
before update on public.albums
for each row execute function public.set_updated_at();

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  file_id uuid not null unique references public.files(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  caption text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index photos_album_idx on public.photos (album_id, created_at desc) where deleted_at is null;
create index photos_uploader_idx on public.photos (uploaded_by);

-- =========================
-- NOTIFICATIONS / AUDIT LOG
-- =========================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type public.notification_type not null default 'system',
  title text not null check (char_length(trim(title)) between 1 and 200),
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where is_read = false;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  action text not null check (char_length(trim(action)) between 1 and 120),
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_class_created_idx on public.activity_logs (class_id, created_at desc);
create index activity_logs_user_created_idx on public.activity_logs (user_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);

-- =========================
-- FK CONSISTENCY TRIGGERS
-- =========================

-- A group task may only assign a member of the same group.
create or replace function public.validate_group_task_assignee()
returns trigger
language plpgsql
as $$
declare
  target_class_id uuid;
begin
  if new.assigned_to is null then
    return new;
  end if;

  select g.class_id into target_class_id
  from public.groups g
  where g.id = new.group_id;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = new.group_id
      and gm.user_id = new.assigned_to
  ) then
    raise exception 'assigned_to must be a member of the group';
  end if;

  return new;
end;
$$;

create trigger group_tasks_validate_assignee
before insert or update on public.group_tasks
for each row execute function public.validate_group_task_assignee();

-- A poll vote option must belong to the same poll referenced by the vote.
create or replace function public.validate_poll_vote_option()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.poll_options po
    where po.id = new.poll_option_id
      and po.poll_id = new.poll_id
  ) then
    raise exception 'poll_option_id does not belong to poll_id';
  end if;
  return new;
end;
$$;

create trigger poll_votes_validate_option
before insert or update on public.poll_votes
for each row execute function public.validate_poll_vote_option();

-- Material attachment must point to a class-scoped file belonging to the same class.
create or replace function public.validate_material_file()
returns trigger
language plpgsql
as $$
declare
  material_class_id uuid;
  target_file_class_id uuid;
begin
  select class_id into material_class_id
  from public.materials
  where id = new.material_id;

  select class_id into target_file_class_id
  from public.files
  where id = new.file_id
    and owner_scope = 'class';

  if material_class_id is null or target_file_class_id is null or material_class_id <> target_file_class_id then
    raise exception 'material file must belong to the same class as the material';
  end if;

  return new;
end;
$$;

create trigger material_files_validate_class
before insert or update on public.material_files
for each row execute function public.validate_material_file();

-- Forum attachment must point to a class-scoped file accessible to the topic class.
create or replace function public.validate_forum_post_file()
returns trigger
language plpgsql
as $$
declare
  topic_class_id uuid;
  file_class_id uuid;
begin
  select ft.class_id into topic_class_id
  from public.forum_posts fp
  join public.forum_topics ft on ft.id = fp.topic_id
  where fp.id = new.post_id;

  select class_id into file_class_id
  from public.files
  where id = new.file_id
    and owner_scope = 'class';

  if topic_class_id is null or file_class_id is null or topic_class_id <> file_class_id then
    raise exception 'forum post file must belong to the same class as the topic';
  end if;

  return new;
end;
$$;

create trigger forum_post_files_validate_class
before insert or update on public.forum_post_files
for each row execute function public.validate_forum_post_file();

-- Photos must use class-scoped files that belong to the album's class.
create or replace function public.validate_photo_file()
returns trigger
language plpgsql
as $$
declare
  album_class_id uuid;
  file_class_id uuid;
begin
  select class_id into album_class_id
  from public.albums
  where id = new.album_id;

  select class_id into file_class_id
  from public.files
  where id = new.file_id
    and owner_scope = 'class';

  if album_class_id is null or file_class_id is null or album_class_id <> file_class_id then
    raise exception 'photo file must belong to the same class as the album';
  end if;

  return new;
end;
$$;

create trigger photos_validate_file
before insert or update on public.photos
for each row execute function public.validate_photo_file();

-- Cash proof files must be class scoped to the class owning the cash account.
create or replace function public.validate_cash_proof_file()
returns trigger
language plpgsql
as $$
declare
  cash_class_id uuid;
  file_class_id uuid;
begin
  if new.proof_file_id is null then
    return new;
  end if;

  select ca.class_id into cash_class_id
  from public.cash_accounts ca
  where ca.id = new.cash_account_id;

  select class_id into file_class_id
  from public.files
  where id = new.proof_file_id
    and owner_scope = 'class';

  if cash_class_id is null or file_class_id is null or cash_class_id <> file_class_id then
    raise exception 'cash proof file must belong to the same class as the cash account';
  end if;

  return new;
end;
$$;

create trigger cash_transactions_validate_proof
before insert or update on public.cash_transactions
for each row execute function public.validate_cash_proof_file();

-- Cash payment proof must be class scoped to the due's class.
create or replace function public.validate_cash_payment_proof_file()
returns trigger
language plpgsql
as $$
declare
  due_class_id uuid;
  file_class_id uuid;
begin
  if new.proof_file_id is null then
    return new;
  end if;

  select cd.class_id into due_class_id
  from public.cash_dues cd
  where cd.id = new.due_id;

  select class_id into file_class_id
  from public.files
  where id = new.proof_file_id
    and owner_scope = 'class';

  if due_class_id is null or file_class_id is null or due_class_id <> file_class_id then
    raise exception 'cash payment proof file must belong to the same class as the due';
  end if;

  return new;
end;
$$;

create trigger cash_payments_validate_proof
before insert or update on public.cash_payments
for each row execute function public.validate_cash_payment_proof_file();

-- Ensure assignment subject belongs to the same class when provided.
create or replace function public.validate_assignment_subject()
returns trigger
language plpgsql
as $$
begin
  if new.subject_id is not null and not exists (
    select 1 from public.subjects s
    where s.id = new.subject_id and s.class_id = new.class_id
  ) then
    raise exception 'subject_id must belong to assignment class_id';
  end if;
  return new;
end;
$$;

create trigger assignments_validate_subject
before insert or update on public.assignments
for each row execute function public.validate_assignment_subject();

-- Ensure material subject belongs to the same class when provided.
create or replace function public.validate_material_subject()
returns trigger
language plpgsql
as $$
begin
  if new.subject_id is not null and not exists (
    select 1 from public.subjects s
    where s.id = new.subject_id and s.class_id = new.class_id
  ) then
    raise exception 'subject_id must belong to material class_id';
  end if;
  return new;
end;
$$;

create trigger materials_validate_subject
before insert or update on public.materials
for each row execute function public.validate_material_subject();

-- A personal note can be private or associated with a class. If class_id is used,
-- the owner must be a current member at write time in trusted server-side paths.
-- RLS remains the authoritative access control boundary.
