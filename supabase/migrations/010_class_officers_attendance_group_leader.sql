-- Student Hub v1.0.6
-- Class officers, internal class attendance, and group leader selection.
-- Self-service create/join class is disabled at application level and RPC execution below is revoked.

-- ============================================================
-- ENUMS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace AND typname='class_position') THEN
    CREATE TYPE public.class_position AS ENUM ('ketua','wakil_ketua','sekretaris','bendahara');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace AND typname='attendance_session_status') THEN
    CREATE TYPE public.attendance_session_status AS ENUM ('open','closed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace AND typname='attendance_status') THEN
    CREATE TYPE public.attendance_status AS ENUM ('present','late','excused','sick','absent');
  END IF;
END $$;

-- ============================================================
-- CLASS OFFICERS / JABATAN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position public.class_position NOT NULL,
  assigned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id),
  UNIQUE (class_id, position)
);
CREATE INDEX IF NOT EXISTS class_positions_class_idx ON public.class_positions(class_id);
CREATE INDEX IF NOT EXISTS class_positions_user_idx ON public.class_positions(user_id);
DROP TRIGGER IF EXISTS trg_class_positions_updated_at ON public.class_positions;
CREATE TRIGGER trg_class_positions_updated_at
BEFORE UPDATE ON public.class_positions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill one chairman from an existing technical admin when a class has no officer yet.
INSERT INTO public.class_positions(class_id,user_id,position,assigned_by)
SELECT cm.class_id, cm.user_id, 'ketua'::public.class_position, cm.user_id
FROM (
  SELECT cm.*, row_number() OVER (PARTITION BY cm.class_id ORDER BY cm.joined_at, cm.user_id) rn
  FROM public.class_members cm
  WHERE cm.status='active' AND cm.role='admin'
) cm
WHERE cm.rn=1
  AND NOT EXISTS (
    SELECT 1 FROM public.class_positions cp WHERE cp.class_id=cm.class_id AND cp.position='ketua'
  );

-- ============================================================
-- GROUP LEADER
-- ============================================================
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS leader_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS groups_leader_idx ON public.groups(leader_user_id);

CREATE OR REPLACE FUNCTION public.validate_group_leader()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.leader_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id=NEW.id AND gm.user_id=NEW.leader_user_id
  ) THEN
    RAISE EXCEPTION 'GROUP_LEADER_MUST_BE_GROUP_MEMBER' USING errcode='23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS group_leader_validate ON public.groups;
CREATE TRIGGER group_leader_validate
BEFORE INSERT OR UPDATE OF leader_user_id ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.validate_group_leader();

CREATE OR REPLACE FUNCTION public.set_group_leader(p_group_id uuid, p_user_id uuid)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE v_group public.groups; v_class_id uuid; v_is_allowed boolean;
BEGIN
  SELECT * INTO v_group FROM public.groups WHERE id=p_group_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;
  v_class_id := v_group.class_id;
  v_is_allowed := public.is_class_admin(v_class_id)
    OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id=p_group_id AND gm.user_id=auth.uid());
  IF NOT v_is_allowed THEN RAISE EXCEPTION 'GROUP_LEADER_PERMISSION_DENIED' USING errcode='42501'; END IF;
  IF p_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id=p_group_id AND gm.user_id=p_user_id) THEN
    RAISE EXCEPTION 'GROUP_LEADER_MUST_BE_GROUP_MEMBER' USING errcode='23514';
  END IF;
  UPDATE public.groups SET leader_user_id=p_user_id WHERE id=p_group_id RETURNING * INTO v_group;
  RETURN v_group;
END;
$$;
REVOKE ALL ON FUNCTION public.set_group_leader(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_group_leader(uuid,uuid) TO authenticated;

-- ============================================================
-- ROLE / CAPABILITY HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION private.has_class_position(p_class_id uuid, p_position public.class_position, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_positions cp
    WHERE cp.class_id=p_class_id AND cp.user_id=coalesce(p_user_id,auth.uid()) AND cp.position=p_position
  );
$$;
REVOKE ALL ON FUNCTION private.has_class_position(uuid,public.class_position,uuid) FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.has_class_position(p_class_id uuid, p_position public.class_position)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$ SELECT private.has_class_position(p_class_id,p_position,auth.uid()); $$;
REVOKE ALL ON FUNCTION public.has_class_position(uuid,public.class_position) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.has_class_position(uuid,public.class_position) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_class_leadership(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$
  SELECT public.is_class_admin(p_class_id)
    OR private.has_class_position(p_class_id,'ketua'::public.class_position,auth.uid())
    OR private.has_class_position(p_class_id,'wakil_ketua'::public.class_position,auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_manage_secretary_features(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$ SELECT public.is_class_leadership(p_class_id) OR private.has_class_position(p_class_id,'sekretaris'::public.class_position,auth.uid()); $$;

CREATE OR REPLACE FUNCTION public.can_manage_cash(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$ SELECT public.is_class_leadership(p_class_id) OR private.has_class_position(p_class_id,'bendahara'::public.class_position,auth.uid()); $$;

CREATE OR REPLACE FUNCTION public.can_manage_attendance(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$ SELECT public.is_class_leadership(p_class_id) OR private.has_class_position(p_class_id,'sekretaris'::public.class_position,auth.uid()); $$;

CREATE OR REPLACE FUNCTION public.can_manage_groups(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$ SELECT public.is_class_leadership(p_class_id); $$;

CREATE OR REPLACE FUNCTION public.can_manage_documentation(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$ SELECT public.is_class_leadership(p_class_id) OR private.has_class_position(p_class_id,'sekretaris'::public.class_position,auth.uid()); $$;

REVOKE ALL ON FUNCTION public.is_class_leadership(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.can_manage_secretary_features(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.can_manage_cash(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.can_manage_attendance(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.can_manage_groups(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.can_manage_documentation(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.is_class_leadership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_secretary_features(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_cash(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_attendance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_groups(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_documentation(uuid) TO authenticated;

-- Make compatibility admin mean leadership for policy checks while retaining legacy admin membership data.
CREATE OR REPLACE FUNCTION private.is_class_admin(p_class_id uuid, p_user_id uuid default auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id=p_class_id AND cm.user_id=coalesce(p_user_id,auth.uid()) AND cm.status='active' AND cm.role='admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.class_positions cp
    WHERE cp.class_id=p_class_id AND cp.user_id=coalesce(p_user_id,auth.uid()) AND cp.position IN ('ketua','wakil_ketua')
  );
$$;

-- ============================================================
-- POSITION ASSIGNMENT RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_class_position(p_class_id uuid, p_user_id uuid, p_position public.class_position)
RETURNS public.class_positions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,private
AS $$
DECLARE v_position public.class_positions;
BEGIN
  IF NOT public.is_class_leadership(p_class_id) THEN RAISE EXCEPTION 'LEADERSHIP_REQUIRED' USING errcode='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_members WHERE class_id=p_class_id AND user_id=p_user_id AND status='active') THEN
    RAISE EXCEPTION 'TARGET_MUST_BE_ACTIVE_CLASS_MEMBER';
  END IF;
  IF p_position IN ('ketua','wakil_ketua','sekretaris','bendahara') THEN
    -- A student can hold one class-wide office at a time. Never remove an existing office
    -- unless the requested target position is available.
    IF EXISTS (SELECT 1 FROM public.class_positions WHERE class_id=p_class_id AND position=p_position AND user_id<>p_user_id) THEN
      RAISE EXCEPTION 'POSITION_ALREADY_ASSIGNED' USING errcode='23505';
    END IF;
    DELETE FROM public.class_positions WHERE class_id=p_class_id AND user_id=p_user_id;
    INSERT INTO public.class_positions(class_id,user_id,position,assigned_by)
    VALUES(p_class_id,p_user_id,p_position,auth.uid()) RETURNING * INTO v_position;
  END IF;
  RETURN v_position;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_class_position(uuid,uuid,public.class_position) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.assign_class_position(uuid,uuid,public.class_position) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_class_position(p_class_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private
AS $$
BEGIN
  IF NOT public.is_class_leadership(p_class_id) THEN RAISE EXCEPTION 'LEADERSHIP_REQUIRED' USING errcode='42501'; END IF;
  DELETE FROM public.class_positions WHERE class_id=p_class_id AND user_id=p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_class_position(uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.remove_class_position(uuid,uuid) TO authenticated;

-- ============================================================
-- INTERNAL CLASS ATTENDANCE (NOT CAMPUS OFFICIAL ATTENDANCE)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  attendance_date date NOT NULL,
  starts_at time,
  ends_at time,
  status public.attendance_session_status NOT NULL DEFAULT 'open',
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_unique_day
ON public.attendance_sessions(class_id,subject_id,attendance_date)
WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS attendance_sessions_class_date_idx ON public.attendance_sessions(class_id,attendance_date DESC) WHERE deleted_at IS NULL;
CREATE TRIGGER attendance_sessions_updated_at
BEFORE UPDATE ON public.attendance_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  note text,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id,user_id)
);
CREATE INDEX IF NOT EXISTS attendance_records_user_idx ON public.attendance_records(user_id,recorded_at DESC);
CREATE INDEX IF NOT EXISTS attendance_records_session_idx ON public.attendance_records(session_id);
CREATE TRIGGER attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
DECLARE v_row public.attendance_sessions;
BEGIN
  IF NOT public.can_manage_attendance(p_class_id) THEN RAISE EXCEPTION 'ATTENDANCE_MANAGER_REQUIRED' USING errcode='42501'; END IF;
  IF p_subject_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.subjects WHERE id=p_subject_id AND class_id=p_class_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'SUBJECT_NOT_IN_CLASS';
  END IF;
  INSERT INTO public.attendance_sessions(class_id,subject_id,attendance_date,starts_at,ends_at,notes,created_by)
  VALUES(p_class_id,p_subject_id,p_attendance_date,p_starts_at,p_ends_at,nullif(trim(p_notes),''),auth.uid())
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.create_attendance_session(uuid,uuid,date,time,time,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.create_attendance_session(uuid,uuid,date,time,time,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_attendance_record(
  p_session_id uuid,
  p_user_id uuid,
  p_status public.attendance_status,
  p_note text DEFAULT NULL
)
RETURNS public.attendance_records
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private
AS $$
DECLARE v_session public.attendance_sessions; v_row public.attendance_records; target_class uuid;
BEGIN
  SELECT * INTO v_session FROM public.attendance_sessions WHERE id=p_session_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_SESSION_NOT_FOUND'; END IF;
  target_class := v_session.class_id;
  IF NOT public.can_manage_attendance(target_class) THEN RAISE EXCEPTION 'ATTENDANCE_MANAGER_REQUIRED' USING errcode='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_members WHERE class_id=target_class AND user_id=p_user_id AND status='active') THEN
    RAISE EXCEPTION 'TARGET_NOT_ACTIVE_CLASS_MEMBER';
  END IF;
  IF v_session.status <> 'open' THEN RAISE EXCEPTION 'ATTENDANCE_SESSION_CLOSED'; END IF;
  INSERT INTO public.attendance_records(session_id,user_id,status,note,recorded_by,recorded_at)
  VALUES(p_session_id,p_user_id,p_status,nullif(trim(p_note),''),auth.uid(),now())
  ON CONFLICT(session_id,user_id) DO UPDATE SET status=excluded.status,note=excluded.note,recorded_by=excluded.recorded_by,recorded_at=excluded.recorded_at,updated_at=now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.set_attendance_record(uuid,uuid,public.attendance_status,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.set_attendance_record(uuid,uuid,public.attendance_status,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_attendance_session(p_session_id uuid)
RETURNS public.attendance_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private
AS $$
DECLARE v public.attendance_sessions;
BEGIN
  SELECT * INTO v FROM public.attendance_sessions WHERE id=p_session_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_SESSION_NOT_FOUND'; END IF;
  IF NOT public.can_manage_attendance(v.class_id) THEN RAISE EXCEPTION 'ATTENDANCE_MANAGER_REQUIRED' USING errcode='42501'; END IF;
  UPDATE public.attendance_sessions SET status='closed' WHERE id=p_session_id RETURNING * INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.close_attendance_session(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.close_attendance_session(uuid) TO authenticated;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.class_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_positions_select_member ON public.class_positions;
CREATE POLICY class_positions_select_member ON public.class_positions FOR SELECT TO authenticated
USING (public.is_class_member(class_id));

DROP POLICY IF EXISTS class_positions_insert_leadership ON public.class_positions;
CREATE POLICY class_positions_insert_leadership ON public.class_positions FOR INSERT TO authenticated
WITH CHECK (public.is_class_leadership(class_id));
DROP POLICY IF EXISTS class_positions_update_leadership ON public.class_positions;
CREATE POLICY class_positions_update_leadership ON public.class_positions FOR UPDATE TO authenticated
USING (public.is_class_leadership(class_id)) WITH CHECK (public.is_class_leadership(class_id));
DROP POLICY IF EXISTS class_positions_delete_leadership ON public.class_positions;
CREATE POLICY class_positions_delete_leadership ON public.class_positions FOR DELETE TO authenticated
USING (public.is_class_leadership(class_id));

DROP POLICY IF EXISTS attendance_sessions_select_member ON public.attendance_sessions;
CREATE POLICY attendance_sessions_select_member ON public.attendance_sessions FOR SELECT TO authenticated
USING (public.is_class_member(class_id));
DROP POLICY IF EXISTS attendance_sessions_insert_manager ON public.attendance_sessions;
CREATE POLICY attendance_sessions_insert_manager ON public.attendance_sessions FOR INSERT TO authenticated
WITH CHECK (public.can_manage_attendance(class_id));
DROP POLICY IF EXISTS attendance_sessions_update_manager ON public.attendance_sessions;
CREATE POLICY attendance_sessions_update_manager ON public.attendance_sessions FOR UPDATE TO authenticated
USING (public.can_manage_attendance(class_id)) WITH CHECK (public.can_manage_attendance(class_id));
DROP POLICY IF EXISTS attendance_sessions_delete_manager ON public.attendance_sessions;
CREATE POLICY attendance_sessions_delete_manager ON public.attendance_sessions FOR DELETE TO authenticated
USING (public.can_manage_attendance(class_id));

DROP POLICY IF EXISTS attendance_records_select_own_or_manager ON public.attendance_records;
CREATE POLICY attendance_records_select_own_or_manager ON public.attendance_records FOR SELECT TO authenticated
USING (
  user_id=auth.uid()
  OR EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id=session_id AND public.can_manage_attendance(s.class_id))
);
DROP POLICY IF EXISTS attendance_records_insert_manager ON public.attendance_records;
CREATE POLICY attendance_records_insert_manager ON public.attendance_records FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id=session_id AND public.can_manage_attendance(s.class_id)));
DROP POLICY IF EXISTS attendance_records_update_manager ON public.attendance_records;
CREATE POLICY attendance_records_update_manager ON public.attendance_records FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id=session_id AND public.can_manage_attendance(s.class_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id=session_id AND public.can_manage_attendance(s.class_id)));
DROP POLICY IF EXISTS attendance_records_delete_manager ON public.attendance_records;
CREATE POLICY attendance_records_delete_manager ON public.attendance_records FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id=session_id AND public.can_manage_attendance(s.class_id)));

-- ============================================================
-- SECRETARY FEATURES: announcements, schedules, subjects, materials, docs
-- ============================================================
DROP POLICY IF EXISTS subjects_insert_admin ON public.subjects;
CREATE POLICY subjects_insert_officer ON public.subjects FOR INSERT TO authenticated
WITH CHECK (public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS subjects_update_admin ON public.subjects;
CREATE POLICY subjects_update_officer ON public.subjects FOR UPDATE TO authenticated
USING (public.can_manage_secretary_features(class_id)) WITH CHECK (public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS subjects_delete_admin ON public.subjects;
CREATE POLICY subjects_delete_officer ON public.subjects FOR DELETE TO authenticated
USING (public.can_manage_secretary_features(class_id));

DROP POLICY IF EXISTS schedules_insert_admin ON public.schedules;
CREATE POLICY schedules_insert_officer ON public.schedules FOR INSERT TO authenticated
WITH CHECK (public.can_manage_secretary_features((select class_id from public.subjects where id=subject_id)));
DROP POLICY IF EXISTS schedules_update_admin ON public.schedules;
CREATE POLICY schedules_update_officer ON public.schedules FOR UPDATE TO authenticated
USING (public.can_manage_secretary_features((select class_id from public.subjects where id=subject_id)))
WITH CHECK (public.can_manage_secretary_features((select class_id from public.subjects where id=subject_id)));
DROP POLICY IF EXISTS schedules_delete_admin ON public.schedules;
CREATE POLICY schedules_delete_officer ON public.schedules FOR DELETE TO authenticated
USING (public.can_manage_secretary_features((select class_id from public.subjects where id=subject_id)));

DROP POLICY IF EXISTS assignments_insert_admin ON public.assignments;
CREATE POLICY assignments_insert_leadership ON public.assignments FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.is_class_leadership(class_id));

DROP POLICY IF EXISTS materials_insert_member ON public.materials;
CREATE POLICY materials_insert_officer ON public.materials FOR INSERT TO authenticated
WITH CHECK (public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS materials_update_creator_admin ON public.materials;
CREATE POLICY materials_update_officer ON public.materials FOR UPDATE TO authenticated
USING (public.can_manage_secretary_features(class_id)) WITH CHECK (public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS materials_delete_creator_admin ON public.materials;
CREATE POLICY materials_delete_officer ON public.materials FOR DELETE TO authenticated
USING (public.can_manage_secretary_features(class_id));

DROP POLICY IF EXISTS announcements_insert_admin ON public.announcements;
CREATE POLICY announcements_insert_secretary ON public.announcements FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS announcements_update_admin ON public.announcements;
CREATE POLICY announcements_update_secretary ON public.announcements FOR UPDATE TO authenticated
USING (public.can_manage_secretary_features(class_id)) WITH CHECK (public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS announcements_delete_admin ON public.announcements;
CREATE POLICY announcements_delete_secretary ON public.announcements FOR DELETE TO authenticated
USING (public.can_manage_secretary_features(class_id));

DROP POLICY IF EXISTS albums_insert_member ON public.albums;
CREATE POLICY albums_insert_secretary ON public.albums FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.can_manage_documentation(class_id));
DROP POLICY IF EXISTS albums_update_creator_admin ON public.albums;
CREATE POLICY albums_update_secretary ON public.albums FOR UPDATE TO authenticated
USING (public.can_manage_documentation(class_id)) WITH CHECK (public.can_manage_documentation(class_id));
DROP POLICY IF EXISTS albums_delete_creator_admin ON public.albums;
CREATE POLICY albums_delete_secretary ON public.albums FOR DELETE TO authenticated
USING (public.can_manage_documentation(class_id));

-- ============================================================
-- TREASURER FEATURES
-- ============================================================
DROP POLICY IF EXISTS cash_accounts_update_admin ON public.cash_accounts;
CREATE POLICY cash_accounts_update_treasurer ON public.cash_accounts FOR UPDATE TO authenticated
USING (public.can_manage_cash(class_id)) WITH CHECK (public.can_manage_cash(class_id));
DROP POLICY IF EXISTS cash_transactions_insert_admin ON public.cash_transactions;
CREATE POLICY cash_transactions_insert_treasurer ON public.cash_transactions FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.can_manage_cash((select class_id from public.cash_accounts where id=cash_account_id)));
DROP POLICY IF EXISTS cash_transactions_update_admin ON public.cash_transactions;
CREATE POLICY cash_transactions_update_treasurer ON public.cash_transactions FOR UPDATE TO authenticated
USING (public.can_manage_cash((select class_id from public.cash_accounts where id=cash_account_id))) WITH CHECK (public.can_manage_cash((select class_id from public.cash_accounts where id=cash_account_id)));
DROP POLICY IF EXISTS cash_transactions_delete_admin ON public.cash_transactions;
CREATE POLICY cash_transactions_delete_treasurer ON public.cash_transactions FOR DELETE TO authenticated
USING (public.can_manage_cash((select class_id from public.cash_accounts where id=cash_account_id)));
DROP POLICY IF EXISTS cash_dues_insert_admin ON public.cash_dues;
CREATE POLICY cash_dues_insert_treasurer ON public.cash_dues FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.can_manage_cash(class_id));
DROP POLICY IF EXISTS cash_dues_update_admin ON public.cash_dues;
CREATE POLICY cash_dues_update_treasurer ON public.cash_dues FOR UPDATE TO authenticated
USING (public.can_manage_cash(class_id)) WITH CHECK (public.can_manage_cash(class_id));
DROP POLICY IF EXISTS cash_dues_delete_admin ON public.cash_dues;
CREATE POLICY cash_dues_delete_treasurer ON public.cash_dues FOR DELETE TO authenticated
USING (public.can_manage_cash(class_id));

DROP POLICY IF EXISTS cash_payments_update_own_or_admin ON public.cash_payments;
CREATE POLICY cash_payments_update_own_or_treasurer ON public.cash_payments FOR UPDATE TO authenticated
USING (
  user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.cash_dues d WHERE d.id=due_id AND public.can_manage_cash(d.class_id))
)
WITH CHECK (
  user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.cash_dues d WHERE d.id=due_id AND public.can_manage_cash(d.class_id))
);

-- Polls are treated as a secretary/community-management feature.
DROP POLICY IF EXISTS polls_insert_admin ON public.polls;
CREATE POLICY polls_insert_officer ON public.polls FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS polls_update_admin ON public.polls;
CREATE POLICY polls_update_officer ON public.polls FOR UPDATE TO authenticated
USING (public.can_manage_secretary_features(class_id)) WITH CHECK (public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS polls_delete_admin ON public.polls;
CREATE POLICY polls_delete_officer ON public.polls FOR DELETE TO authenticated
USING (public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS poll_options_insert_admin ON public.poll_options;
CREATE POLICY poll_options_insert_officer ON public.poll_options FOR INSERT TO authenticated
WITH CHECK (public.can_manage_secretary_features((select class_id from public.polls where id=poll_id)));
DROP POLICY IF EXISTS poll_options_update_admin ON public.poll_options;
CREATE POLICY poll_options_update_officer ON public.poll_options FOR UPDATE TO authenticated
USING (public.can_manage_secretary_features((select class_id from public.polls where id=poll_id))) WITH CHECK (public.can_manage_secretary_features((select class_id from public.polls where id=poll_id)));
DROP POLICY IF EXISTS poll_options_delete_admin ON public.poll_options;
CREATE POLICY poll_options_delete_officer ON public.poll_options FOR DELETE TO authenticated
USING (public.can_manage_secretary_features((select class_id from public.polls where id=poll_id)));

-- Group creation is leadership-only; group leader is a separate per-group role.
DROP POLICY IF EXISTS groups_insert_admin ON public.groups;
CREATE POLICY groups_insert_leadership ON public.groups FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.can_manage_groups(class_id));
DROP POLICY IF EXISTS groups_update_admin ON public.groups;
CREATE POLICY groups_update_leadership ON public.groups FOR UPDATE TO authenticated
USING (public.can_manage_groups(class_id)) WITH CHECK (public.can_manage_groups(class_id));
DROP POLICY IF EXISTS groups_delete_admin ON public.groups;
CREATE POLICY groups_delete_leadership ON public.groups FOR DELETE TO authenticated
USING (public.can_manage_groups(class_id));

-- Group leader may manage their group's tasks.
DROP POLICY IF EXISTS group_tasks_update_admin ON public.group_tasks;
CREATE POLICY group_tasks_update_admin_or_leader ON public.group_tasks FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id=group_id
      AND (public.is_class_leadership(g.class_id) OR g.leader_user_id=auth.uid())
  )
  OR assigned_to=auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id=group_id
      AND (public.is_class_leadership(g.class_id) OR g.leader_user_id=auth.uid())
  )
  OR assigned_to=auth.uid()
);

-- Disable self-service create/join class at DB permission level.
REVOKE ALL ON FUNCTION public.create_class(text, public.class_delivery_mode, text, integer, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.join_class_by_code(text) FROM authenticated;

-- ------------------------------------------------------------
-- Position rows are managed only through the validated RPCs.
-- Members can read officer assignments but cannot mutate them directly.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS class_positions_insert_leadership ON public.class_positions;
DROP POLICY IF EXISTS class_positions_update_leadership ON public.class_positions;
DROP POLICY IF EXISTS class_positions_delete_leadership ON public.class_positions;

-- ------------------------------------------------------------
-- Group leaders can manage membership and tasks inside their own group.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS group_members_insert_admin ON public.group_members;
CREATE POLICY group_members_insert_leadership_or_leader ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id=group_id
      AND (public.is_class_leadership(g.class_id) OR g.leader_user_id=auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.class_members cm ON cm.class_id=g.class_id
    WHERE g.id=group_id AND cm.user_id=user_id AND cm.status='active'
  )
);

DROP POLICY IF EXISTS group_members_delete_admin ON public.group_members;
CREATE POLICY group_members_delete_leadership_or_leader ON public.group_members FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id=group_id
      AND (public.is_class_leadership(g.class_id) OR g.leader_user_id=auth.uid())
  )
);

DROP POLICY IF EXISTS group_tasks_insert_admin ON public.group_tasks;
CREATE POLICY group_tasks_insert_leadership_or_leader ON public.group_tasks FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id=group_id
      AND (public.is_class_leadership(g.class_id) OR g.leader_user_id=auth.uid())
  )
  AND (assigned_to IS NULL OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id=group_tasks.group_id AND gm.user_id=assigned_to))
);
DROP POLICY IF EXISTS group_tasks_delete_admin ON public.group_tasks;
CREATE POLICY group_tasks_delete_leadership_or_leader ON public.group_tasks FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id=group_id
      AND (public.is_class_leadership(g.class_id) OR g.leader_user_id=auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.validate_group_task_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE class_id_value uuid; is_leader boolean := false; is_leadership boolean := false;
BEGIN
  SELECT class_id, (leader_user_id = auth.uid()) INTO class_id_value, is_leader FROM public.groups WHERE id=old.group_id;
  is_leadership := public.is_class_leadership(class_id_value);
  IF is_leadership OR is_leader THEN
    IF new.group_id IS DISTINCT FROM old.group_id THEN RAISE EXCEPTION 'GROUP_MOVE_NOT_ALLOWED'; END IF;
    IF new.assigned_to IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id=old.group_id AND gm.user_id=new.assigned_to) THEN
      RAISE EXCEPTION 'ASSIGNEE_MUST_BE_GROUP_MEMBER';
    END IF;
    RETURN new;
  END IF;

  IF old.assigned_to IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'NOT_ASSIGNED_TO_CURRENT_USER' USING errcode='42501';
  END IF;
  IF new.group_id IS DISTINCT FROM old.group_id
     OR new.assigned_to IS DISTINCT FROM old.assigned_to
     OR new.title IS DISTINCT FROM old.title
     OR new.description IS DISTINCT FROM old.description
     OR new.deadline IS DISTINCT FROM old.deadline
     OR new.deleted_at IS DISTINCT FROM old.deleted_at THEN
    RAISE EXCEPTION 'GROUP_TASK_ASSIGNEE_CAN_ONLY_CHANGE_COMPLETION' USING errcode='42501';
  END IF;
  RETURN new;
END;
$$;
