-- 004_storage_policies.sql
-- Private Supabase Storage buckets for Student Hub.
-- Path conventions:
-- avatars/{user_id}/{filename}
-- class-files/{class_id}/{yyyy}/{mm}/{uuid}-{filename}
-- class-photos/{class_id}/{album_id}/{uuid}-{filename}

-- Create the three private buckets using Supabase Dashboard or supported CLI/API.
-- Required buckets and limits are documented in docs/08_STORAGE_SPEC.md.

-- Avatars: user owns only their own path.
create policy storage_avatar_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy storage_avatar_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy storage_avatar_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy storage_avatar_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Class files: first path segment is class UUID.
create policy storage_class_files_select_member
on storage.objects for select to authenticated
using (
  bucket_id = 'class-files'
  and public.is_class_member_from_text((storage.foldername(name))[1])
);

create policy storage_class_files_insert_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'class-files'
  and public.is_class_member_from_text((storage.foldername(name))[1])
);

create policy storage_class_files_update_owner_or_admin
on storage.objects for update to authenticated
using (
  bucket_id = 'class-files'
  and public.is_class_member_from_text((storage.foldername(name))[1])
  and (
    owner_id = (select auth.uid()::text)
    or public.is_class_admin_from_text((storage.foldername(name))[1])
  )
)
with check (
  bucket_id = 'class-files'
  and public.is_class_member_from_text((storage.foldername(name))[1])
);

create policy storage_class_files_delete_owner_or_admin
on storage.objects for delete to authenticated
using (
  bucket_id = 'class-files'
  and public.is_class_member_from_text((storage.foldername(name))[1])
  and (
    owner_id = (select auth.uid()::text)
    or public.is_class_admin_from_text((storage.foldername(name))[1])
  )
);

-- Class photos: first path segment is class UUID.
create policy storage_class_photos_select_member
on storage.objects for select to authenticated
using (
  bucket_id = 'class-photos'
  and public.is_class_member_from_text((storage.foldername(name))[1])
);

create policy storage_class_photos_insert_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'class-photos'
  and public.is_class_member_from_text((storage.foldername(name))[1])
);

create policy storage_class_photos_update_owner_or_admin
on storage.objects for update to authenticated
using (
  bucket_id = 'class-photos'
  and public.is_class_member_from_text((storage.foldername(name))[1])
  and (
    owner_id = (select auth.uid()::text)
    or public.is_class_admin_from_text((storage.foldername(name))[1])
  )
)
with check (
  bucket_id = 'class-photos'
  and public.is_class_member_from_text((storage.foldername(name))[1])
);

create policy storage_class_photos_delete_owner_or_admin
on storage.objects for delete to authenticated
using (
  bucket_id = 'class-photos'
  and public.is_class_member_from_text((storage.foldername(name))[1])
  and (
    owner_id = (select auth.uid()::text)
    or public.is_class_admin_from_text((storage.foldername(name))[1])
  )
);
