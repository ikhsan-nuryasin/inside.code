-- Student Hub v1
-- 005_shared_notes_rpc.sql
-- Optimistic concurrency control for collaborative shared notes.

create or replace function public.update_shared_note_with_version(
  p_note_id uuid,
  p_title text,
  p_content text,
  p_base_version integer
)
returns public.shared_notes
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_row public.shared_notes;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_base_version is null or p_base_version < 1 then
    raise exception 'invalid base version';
  end if;

  update public.shared_notes sn
     set title = p_title,
         content = p_content,
         version = sn.version + 1,
         updated_at = now()
   where sn.id = p_note_id
     and sn.version = p_base_version
     and sn.deleted_at is null
  returning sn.* into updated_row;

  if updated_row.id is null then
    -- The calling client must distinguish a concurrency conflict from a missing row.
    if not exists (
      select 1
      from public.shared_notes sn
      where sn.id = p_note_id
        and sn.deleted_at is null
    ) then
      raise exception 'shared note not found' using errcode = 'P0002';
    end if;

    raise exception 'shared note version conflict' using errcode = '40001';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.update_shared_note_with_version(uuid, text, text, integer) from public;
revoke all on function public.update_shared_note_with_version(uuid, text, text, integer) from anon;
grant execute on function public.update_shared_note_with_version(uuid, text, text, integer) to authenticated;
