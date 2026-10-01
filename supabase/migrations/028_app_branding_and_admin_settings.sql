-- Inside Code 1.8.2: global branding and application settings.
-- App admins are the existing class admins plus optional entries in system_admins.

create table if not exists public.system_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.system_admins enable row level security;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.system_admins sa where sa.user_id = auth.uid()
  )
  or exists (
    select 1 from public.class_members cm
    where cm.user_id = auth.uid()
      and cm.role = 'admin'
      and cm.status = 'active'
  );
$$;

revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

create policy system_admins_select_self
on public.system_admins for select to authenticated
using (user_id = auth.uid());

-- Public-readable branding only. Writes are restricted to app admins.
create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  app_name text not null default 'Inside Code' check (char_length(trim(app_name)) between 1 and 80),
  short_name text not null default 'Inside Code' check (char_length(trim(short_name)) between 1 and 40),
  tagline text not null default 'Ruang kelas mahasiswa' check (char_length(trim(tagline)) between 1 and 160),
  login_title text not null default 'Semua urusan kelas, masuk dari satu akun.' check (char_length(trim(login_title)) between 1 and 220),
  login_description text not null default 'Login untuk mengakses tugas, jadwal, materi, forum, kelompok, kas, bantuan, dan Pesan Cepat.' check (char_length(trim(login_description)) between 1 and 320),
  primary_color text not null default '#087cf9' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select_public on public.app_settings;
create policy app_settings_select_public
on public.app_settings for select to anon, authenticated
using (id = 1);

drop policy if exists app_settings_update_admin on public.app_settings;
create policy app_settings_update_admin
on public.app_settings for update to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

-- Public bucket because login branding must be visible before authentication.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app-assets', 'app-assets', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists app_assets_public_read on storage.objects;
create policy app_assets_public_read
on storage.objects for select
using (bucket_id = 'app-assets');

drop policy if exists app_assets_admin_insert on storage.objects;
create policy app_assets_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'app-assets' and public.is_app_admin());

drop policy if exists app_assets_admin_update on storage.objects;
create policy app_assets_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'app-assets' and public.is_app_admin())
with check (bucket_id = 'app-assets' and public.is_app_admin());

drop policy if exists app_assets_admin_delete on storage.objects;
create policy app_assets_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'app-assets' and public.is_app_admin());
