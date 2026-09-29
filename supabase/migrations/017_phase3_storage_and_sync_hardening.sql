-- Student Hub v1.1.0 Phase 3 hardening: storage + safe sync events.

-- ============================================================
-- 1. Cash proof storage
-- cash-proofs/{class_id}/{user_id}/{payment_id}/{uuid}-{filename}
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cash-proofs', 'cash-proofs', false, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS storage_cash_proofs_select_member ON storage.objects;
CREATE POLICY storage_cash_proofs_select_member
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cash-proofs'
  AND public.is_class_member_from_text((storage.foldername(name))[1])
);

DROP POLICY IF EXISTS storage_cash_proofs_insert_own ON storage.objects;
CREATE POLICY storage_cash_proofs_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cash-proofs'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_class_member_from_text((storage.foldername(name))[1])
);

DROP POLICY IF EXISTS storage_cash_proofs_update_own_or_manager ON storage.objects;
CREATE POLICY storage_cash_proofs_update_own_or_manager
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'cash-proofs'
  AND public.is_class_member_from_text((storage.foldername(name))[1])
  AND (
    owner_id = auth.uid()::text
    OR public.can_manage_cash((storage.foldername(name))[1]::uuid)
  )
)
WITH CHECK (
  bucket_id = 'cash-proofs'
  AND public.is_class_member_from_text((storage.foldername(name))[1])
);

DROP POLICY IF EXISTS storage_cash_proofs_delete_own_or_manager ON storage.objects;
CREATE POLICY storage_cash_proofs_delete_own_or_manager
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cash-proofs'
  AND public.is_class_member_from_text((storage.foldername(name))[1])
  AND (
    owner_id = auth.uid()::text
    OR public.can_manage_cash((storage.foldername(name))[1]::uuid)
  )
);

-- ============================================================
-- 2. Storage policy alignment with current leadership model
-- ============================================================
DROP POLICY IF EXISTS storage_class_files_update_owner_or_admin ON storage.objects;
CREATE POLICY storage_class_files_update_owner_or_manager
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'class-files'
  AND public.is_class_member_from_text((storage.foldername(name))[1])
  AND (
    owner_id = auth.uid()::text
    OR public.is_class_leadership((storage.foldername(name))[1]::uuid)
  )
)
WITH CHECK (
  bucket_id = 'class-files'
  AND public.is_class_member_from_text((storage.foldername(name))[1])
);

DROP POLICY IF EXISTS storage_class_files_delete_owner_or_admin ON storage.objects;
CREATE POLICY storage_class_files_delete_owner_or_manager
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'class-files'
  AND public.is_class_member_from_text((storage.foldername(name))[1])
  AND (
    owner_id = auth.uid()::text
    OR public.is_class_leadership((storage.foldername(name))[1]::uuid)
  )
);

-- ============================================================
-- 3. Safe change-feed event capture
-- Avoid direct NEW.some_column references on junction tables.
-- ============================================================
CREATE OR REPLACE FUNCTION public.capture_sync_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private
AS $$
DECLARE
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  v_id uuid;
  v_class uuid;
  v_user uuid;
  v_file uuid;
BEGIN
  v_id := COALESCE(NULLIF(v_new->>'id','')::uuid, NULLIF(v_old->>'id','')::uuid);
  v_class := COALESCE(NULLIF(v_new->>'class_id','')::uuid, NULLIF(v_old->>'class_id','')::uuid);
  v_user := COALESCE(NULLIF(v_new->>'user_id','')::uuid, NULLIF(v_old->>'user_id','')::uuid);
  IF v_id IS NULL THEN
    v_id := COALESCE(NULLIF(v_new->>'file_id','')::uuid, NULLIF(v_old->>'file_id','')::uuid);
  END IF;
  IF v_id IS NULL THEN
    v_id := COALESCE(NULLIF(v_new->>'post_id','')::uuid, NULLIF(v_old->>'post_id','')::uuid);
  END IF;
  IF v_id IS NULL THEN
    v_id := COALESCE(NULLIF(v_new->>'material_id','')::uuid, NULLIF(v_old->>'material_id','')::uuid);
  END IF;
  IF v_id IS NULL THEN
    v_id := COALESCE(NULLIF(v_new->>'announcement_id','')::uuid, NULLIF(v_old->>'announcement_id','')::uuid);
  END IF;
  IF v_id IS NULL THEN
    v_id := COALESCE(NULLIF(v_new->>'assignment_id','')::uuid, NULLIF(v_old->>'assignment_id','')::uuid);
  END IF;
  IF v_id IS NULL THEN
    v_id := COALESCE(NULLIF(v_new->>'group_id','')::uuid, NULLIF(v_old->>'group_id','')::uuid);
  END IF;
  IF v_id IS NULL THEN
    v_id := COALESCE(NULLIF(v_new->>'poll_id','')::uuid, NULLIF(v_old->>'poll_id','')::uuid);
  END IF;

  v_class := public.sync_event_class_id(TG_TABLE_NAME,v_id,v_class,v_user);
  INSERT INTO public.sync_events(table_name,entity_id,class_id,user_id)
  VALUES (TG_TABLE_NAME,v_id,v_class,v_user);
  RETURN COALESCE(NEW,OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'classes','class_members','class_positions','subjects','schedules','assignments','assignment_progress',
    'assignment_checklist_items','checklist_progress','assignment_files','materials','material_files','files',
    'announcements','announcement_reads','forum_topics','forum_posts','forum_post_files','forum_reports',
    'groups','group_members','group_tasks','polls','poll_options','poll_votes','cash_accounts','cash_transactions',
    'cash_dues','cash_payments','shared_notes','class_admin_notes','albums','photos','personal_notes','notifications'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_%I ON public.%I',t,t);
    EXECUTE format('CREATE TRIGGER trg_sync_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_sync_event()',t,t);
  END LOOP;
END $$;

COMMENT ON TABLE public.sync_events IS 'Monotonic change feed for bounded offline synchronization. RLS/RPC restricts visibility to current user and their classes.';
