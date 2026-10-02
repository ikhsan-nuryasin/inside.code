-- 032_fix_auth_profile_full_name.sql
-- Fix auth.users -> profiles trigger for signup/invite flows.
-- Cause: invited users may have no raw_user_meta_data.full_name, while
-- profiles.full_name is NOT NULL and requires 1..150 trimmed characters.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_full_name text;
begin
    -- Prefer the name supplied by the application during normal signup.
    v_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');

    -- Supabase dashboard/API invites may not include profile metadata.
    -- Fall back to the email local-part so the profiles constraint is satisfied.
    if v_full_name is null then
        v_full_name := nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), '');
    end if;

    -- Final safe fallback for users without a usable name/email.
    v_full_name := left(coalesce(v_full_name, 'Mahasiswa'), 150);

    if char_length(trim(v_full_name)) < 1 then
        v_full_name := 'Mahasiswa';
    end if;

    insert into public.profiles (id, full_name)
    values (new.id, v_full_name)
    on conflict (id) do nothing;

    return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
