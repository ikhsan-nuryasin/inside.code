-- Student Hub v1.5.0 — support center + authenticated bug reports.
-- No attendance, lecturer account, class creation, or class-join workflow is introduced.

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  category text not null check (category in ('ui','feature','performance','offline_sync','account','other')),
  severity text not null check (severity in ('low','medium','high','critical')),
  description text not null check (char_length(trim(description)) between 1 and 5000),
  steps text,
  expected_behavior text,
  actual_behavior text,
  page_path text,
  user_agent text,
  status text not null default 'open' check (status in ('open','reviewing','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bug_reports_user_created_idx
  on public.bug_reports(user_id, created_at desc);
create index if not exists bug_reports_status_idx
  on public.bug_reports(status, created_at desc);

 drop trigger if exists bug_reports_set_updated_at on public.bug_reports;
create trigger bug_reports_set_updated_at
before update on public.bug_reports
for each row execute function public.set_updated_at();

alter table public.bug_reports enable row level security;

drop policy if exists bug_reports_select_own on public.bug_reports;
create policy bug_reports_select_own on public.bug_reports
for select to authenticated
using (user_id = auth.uid());

drop policy if exists bug_reports_insert_own on public.bug_reports;
create policy bug_reports_insert_own on public.bug_reports
for insert to authenticated
with check (user_id = auth.uid());

grant select, insert on public.bug_reports to authenticated;

-- Include reports in the incremental change feed so offline clients can invalidate support cache safely.
drop trigger if exists trg_sync_bug_reports on public.bug_reports;
create trigger trg_sync_bug_reports
after insert or update or delete on public.bug_reports
for each row execute function public.capture_sync_event();
