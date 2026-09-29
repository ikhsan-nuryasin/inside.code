-- Student Hub v1.0.6 role-based workflow hardening.
-- This migration assumes 001..010 were applied in order.

-- ============================================================
-- Schedule template: secretary may apply the official template too.
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_schedule_template(p_class_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, private
AS $$
DECLARE
  v_count integer := 0;
  v_subject_id uuid;
  v_mode public.class_delivery_mode;
  r record;
BEGIN
  IF NOT public.can_manage_secretary_features(p_class_id) THEN
    RAISE EXCEPTION USING errcode='42501', message='SECRETARY_FEATURE_REQUIRED';
  END IF;

  SELECT delivery_mode INTO v_mode
  FROM public.classes
  WHERE id = p_class_id AND deleted_at IS NULL;

  IF v_mode IS NULL THEN
    RAISE EXCEPTION 'CLASS_NOT_FOUND';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('SISTEM INFORMASI MANAJEMEN','240','TRT',3,NULL,1,'17:30'::time,'19:30'::time,'301-E5'),
      ('KEAMANAN BASIS DATA','0405','ECR',3,NULL,1,'19:30'::time,'21:30'::time,'301-E5'),
      ('METODOLOGI PENELITIAN','0367','WYR',3,NULL,2,'17:30'::time,'19:30'::time,'301-E5'),
      ('WEB PROGRAMMING II','0407','FZR',3,'WPP.19.3B.14A',2,'19:30'::time,'21:30'::time,'301-E5'),
      ('BAHASA INDONESIA','253','RBP',2,NULL,3,'18:10'::time,'19:30'::time,'E1.3-E5'),
      ('CHARACTER BUILDING','154','CYG',3,NULL,3,'19:30'::time,'21:30'::time,'E1.3-E5'),
      ('FUNDAMENTAL DATA ANALYST','0406','IMK',3,NULL,4,'17:30'::time,'19:30'::time,'301-E5'),
      ('STATISTIKA DAN PROBABILITAS','0624','ERH',3,NULL,4,'19:30'::time,'21:30'::time,'301-E5')
    ) AS x(name,code,lecturer_code,credits,practical_group,day_of_week,starts_at,ends_at,room)
  LOOP
    INSERT INTO public.subjects(class_id,name,code,lecturer_code,lecturer_code_secondary,credits,practical_group)
    VALUES(p_class_id,r.name,r.code,r.lecturer_code,NULL,r.credits,r.practical_group)
    ON CONFLICT (class_id, code) WHERE code IS NOT NULL AND deleted_at IS NULL
    DO UPDATE SET
      name=excluded.name,
      lecturer_code=excluded.lecturer_code,
      credits=excluded.credits,
      practical_group=excluded.practical_group,
      deleted_at=NULL
    RETURNING id INTO v_subject_id;

    INSERT INTO public.schedules(subject_id,day_of_week,starts_at,ends_at,room,location,meeting_url,notes)
    VALUES(
      v_subject_id,
      r.day_of_week,
      r.starts_at,
      r.ends_at,
      CASE WHEN v_mode='offline' THEN r.room ELSE NULL END,
      NULL,
      NULL,
      NULL
    )
    ON CONFLICT (subject_id,day_of_week,starts_at,ends_at) WHERE deleted_at IS NULL
    DO UPDATE SET
      room=excluded.room,
      location=NULL,
      meeting_url=NULL,
      notes=NULL,
      deleted_at=NULL;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_schedule_template(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_schedule_template(uuid) TO authenticated;

-- ============================================================
-- Remove direct class creation path. Classes are provisioned by
-- the system/operator workflow, not by a normal client member.
-- ============================================================
DROP POLICY IF EXISTS classes_insert_own ON public.classes;
REVOKE ALL ON FUNCTION public.create_class(text, public.class_delivery_mode, text, integer, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.join_class_by_code(text) FROM authenticated;

-- ============================================================
-- Officers are managed through RPC only.
-- ============================================================
DROP POLICY IF EXISTS class_positions_insert_leadership ON public.class_positions;
DROP POLICY IF EXISTS class_positions_update_leadership ON public.class_positions;
DROP POLICY IF EXISTS class_positions_delete_leadership ON public.class_positions;

-- ============================================================
-- Shared notes: direct member UPDATE is blocked so version RPC is
-- the only write path for collaboration.
-- ============================================================
DROP POLICY IF EXISTS shared_notes_update_member ON public.shared_notes;

-- ============================================================
-- Files: metadata ownership is immutable. Only soft-delete or
-- harmless metadata edits should be possible at the application layer.
-- ============================================================
DROP POLICY IF EXISTS files_update_owner_or_admin ON public.files;
CREATE POLICY files_update_safe_metadata ON public.files
FOR UPDATE TO authenticated
USING (
  uploaded_by=auth.uid()
  OR (class_id IS NOT NULL AND public.is_class_leadership(class_id))
)
WITH CHECK (
  uploaded_by=auth.uid()
  OR (class_id IS NOT NULL AND public.is_class_leadership(class_id))
);

-- ============================================================
-- Profiles: keep normal profile privacy to own profile only. Other
-- user names used by attendance/officer/group features are fetched
-- through scoped relational queries already protected by membership.
-- ============================================================
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles
FOR SELECT TO authenticated
USING (id=auth.uid());

-- ============================================================
-- Enforce position-based authority only. Legacy class_members.role='admin'
-- remains as historical data but no longer grants operational authority.
-- The v1.0.6 backfill maps existing technical admins to class positions.
-- ============================================================
CREATE OR REPLACE FUNCTION private.is_class_admin(p_class_id uuid, p_user_id uuid default auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_positions cp
    WHERE cp.class_id=p_class_id
      AND cp.user_id=coalesce(p_user_id,auth.uid())
      AND cp.position IN ('ketua','wakil_ketua')
  );
$$;

-- Keep scoped profile visibility for class operations (attendance/officer/group).
-- There is still no member directory in the application UI.
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
DROP POLICY IF EXISTS profiles_select_same_class ON public.profiles;
CREATE POLICY profiles_select_self_or_same_class ON public.profiles
FOR SELECT TO authenticated
USING (
  id=auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.class_members viewer
    JOIN public.class_members target
      ON target.class_id=viewer.class_id
    WHERE viewer.user_id=auth.uid()
      AND viewer.status='active'
      AND target.user_id=profiles.id
      AND target.status='active'
  )
);

-- ============================================================
-- Attendance sessions pre-create an absent row for every active member.
-- Officers then change the status to present/late/excused/sick as needed.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_attendance_session(
  p_class_id uuid,
  p_subject_id uuid,
  p_attendance_date date,
  p_starts_at time DEFAULT NULL,
  p_ends_at time DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.attendance_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private
AS $$
DECLARE
  v_row public.attendance_sessions;
BEGIN
  IF NOT public.can_manage_attendance(p_class_id) THEN
    RAISE EXCEPTION 'ATTENDANCE_MANAGER_REQUIRED' USING errcode='42501';
  END IF;
  IF p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subjects
    WHERE id=p_subject_id AND class_id=p_class_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SUBJECT_NOT_IN_CLASS';
  END IF;

  INSERT INTO public.attendance_sessions(
    class_id,subject_id,attendance_date,starts_at,ends_at,notes,created_by
  )
  VALUES(
    p_class_id,p_subject_id,p_attendance_date,p_starts_at,p_ends_at,
    nullif(trim(p_notes),''),auth.uid()
  )
  RETURNING * INTO v_row;

  INSERT INTO public.attendance_records(
    session_id,user_id,status,note,recorded_by,recorded_at
  )
  SELECT
    v_row.id,
    cm.user_id,
    'absent'::public.attendance_status,
    NULL,
    auth.uid(),
    now()
  FROM public.class_members cm
  WHERE cm.class_id=p_class_id
    AND cm.status='active';

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.create_attendance_session(uuid,uuid,date,time,time,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.create_attendance_session(uuid,uuid,date,time,time,text) TO authenticated;

-- ============================================================
-- Audit log writes are reserved for trusted server-side/RPC code.
-- A browser user must not be able to invent arbitrary audit entries.
-- ============================================================
REVOKE INSERT ON public.activity_logs FROM authenticated;

-- ============================================================
-- Protect immutable file identity fields. The uploader may not move a
-- file between classes/buckets or replace the underlying storage path by
-- updating a database row.
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_file_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
     OR NEW.owner_scope IS DISTINCT FROM OLD.owner_scope
     OR NEW.class_id IS DISTINCT FROM OLD.class_id
     OR NEW.bucket IS DISTINCT FROM OLD.bucket
     OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.file_size IS DISTINCT FROM OLD.file_size
     OR NEW.mime_type IS DISTINCT FROM OLD.mime_type THEN
    RAISE EXCEPTION 'FILE_IDENTITY_IS_IMMUTABLE' USING errcode='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_file_identity ON public.files;
CREATE TRIGGER trg_protect_file_identity
BEFORE UPDATE ON public.files
FOR EACH ROW EXECUTE FUNCTION public.protect_file_identity();
