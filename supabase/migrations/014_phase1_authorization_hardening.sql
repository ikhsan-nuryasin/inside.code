-- Student Hub v1.0.8 Phase 1 authorization hardening.
-- Applies after migrations 001..013.
-- This migration does NOT add attendance and does not re-enable class creation/joining.

-- ============================================================
-- 1. Leadership is the only role allowed to manage class tasks.
--    Historical creator/admin policies are replaced because the
--    current product uses class positions as the authority boundary.
-- ============================================================
DROP POLICY IF EXISTS assignments_update_creator_or_admin ON public.assignments;
DROP POLICY IF EXISTS assignments_delete_creator_or_admin ON public.assignments;
CREATE POLICY assignments_update_leadership
ON public.assignments FOR UPDATE TO authenticated
USING (public.is_class_leadership(class_id))
WITH CHECK (public.is_class_leadership(class_id));
CREATE POLICY assignments_delete_leadership
ON public.assignments FOR DELETE TO authenticated
USING (public.is_class_leadership(class_id));

DROP POLICY IF EXISTS assignment_checklist_insert_creator_admin ON public.assignment_checklist_items;
DROP POLICY IF EXISTS assignment_checklist_update_creator_admin ON public.assignment_checklist_items;
DROP POLICY IF EXISTS assignment_checklist_delete_creator_admin ON public.assignment_checklist_items;
CREATE POLICY assignment_checklist_insert_leadership
ON public.assignment_checklist_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id=assignment_id AND public.is_class_leadership(a.class_id)
  )
);
CREATE POLICY assignment_checklist_update_leadership
ON public.assignment_checklist_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id=assignment_id AND public.is_class_leadership(a.class_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id=assignment_id AND public.is_class_leadership(a.class_id)
  )
);
CREATE POLICY assignment_checklist_delete_leadership
ON public.assignment_checklist_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id=assignment_id AND public.is_class_leadership(a.class_id)
  )
);

-- ============================================================
-- 2. A user cannot demote/remove the only remaining leadership
--    position. Reassigning to another leadership position remains valid.
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_class_position(
  p_class_id uuid,
  p_user_id uuid,
  p_position public.class_position
)
RETURNS public.class_positions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,private
AS $$
DECLARE
  v_position public.class_positions;
  v_current public.class_positions;
  v_leaders integer;
BEGIN
  IF NOT public.is_class_leadership(p_class_id) THEN
    RAISE EXCEPTION 'LEADERSHIP_REQUIRED' USING errcode='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id=p_class_id AND user_id=p_user_id AND status='active'
  ) THEN
    RAISE EXCEPTION 'TARGET_MUST_BE_ACTIVE_CLASS_MEMBER';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.class_positions
    WHERE class_id=p_class_id AND position=p_position AND user_id<>p_user_id
  ) THEN
    RAISE EXCEPTION 'POSITION_ALREADY_ASSIGNED' USING errcode='23505';
  END IF;

  SELECT * INTO v_current
  FROM public.class_positions
  WHERE class_id=p_class_id AND user_id=p_user_id;

  IF FOUND
     AND v_current.position IN ('ketua','wakil_ketua')
     AND p_position NOT IN ('ketua','wakil_ketua') THEN
    SELECT count(*) INTO v_leaders
    FROM public.class_positions
    WHERE class_id=p_class_id AND position IN ('ketua','wakil_ketua');
    IF v_leaders <= 1 THEN
      RAISE EXCEPTION 'CLASS_MUST_HAVE_LEADERSHIP' USING errcode='23514';
    END IF;
  END IF;

  DELETE FROM public.class_positions
  WHERE class_id=p_class_id AND user_id=p_user_id;

  INSERT INTO public.class_positions(class_id,user_id,position,assigned_by)
  VALUES(p_class_id,p_user_id,p_position,auth.uid())
  RETURNING * INTO v_position;

  RETURN v_position;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_class_position(uuid,uuid,public.class_position) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.assign_class_position(uuid,uuid,public.class_position) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_class_position(p_class_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,private
AS $$
DECLARE
  v_current public.class_positions;
  v_leaders integer;
BEGIN
  IF NOT public.is_class_leadership(p_class_id) THEN
    RAISE EXCEPTION 'LEADERSHIP_REQUIRED' USING errcode='42501';
  END IF;

  SELECT * INTO v_current
  FROM public.class_positions
  WHERE class_id=p_class_id AND user_id=p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_current.position IN ('ketua','wakil_ketua') THEN
    SELECT count(*) INTO v_leaders
    FROM public.class_positions
    WHERE class_id=p_class_id AND position IN ('ketua','wakil_ketua');
    IF v_leaders <= 1 THEN
      RAISE EXCEPTION 'CLASS_MUST_HAVE_LEADERSHIP' USING errcode='23514';
    END IF;
  END IF;

  DELETE FROM public.class_positions
  WHERE class_id=p_class_id AND user_id=p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_class_position(uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.remove_class_position(uuid,uuid) TO authenticated;

-- ============================================================
-- 3. Group leader assignment is restricted to class leadership or
--    the current group leader. Ordinary group members cannot appoint
--    someone else as leader.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_group_leader(p_group_id uuid, p_user_id uuid)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,private
AS $$
DECLARE
  v_group public.groups;
  v_class_id uuid;
  v_allowed boolean;
BEGIN
  SELECT * INTO v_group
  FROM public.groups
  WHERE id=p_group_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;

  v_class_id := v_group.class_id;
  v_allowed := public.is_class_leadership(v_class_id)
    OR v_group.leader_user_id = auth.uid();

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'GROUP_LEADER_PERMISSION_DENIED' USING errcode='42501';
  END IF;

  IF p_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id=p_group_id AND gm.user_id=p_user_id
  ) THEN
    RAISE EXCEPTION 'GROUP_LEADER_MUST_BE_GROUP_MEMBER' USING errcode='23514';
  END IF;

  UPDATE public.groups
  SET leader_user_id=p_user_id, updated_at=now()
  WHERE id=p_group_id
  RETURNING * INTO v_group;

  RETURN v_group;
END;
$$;
REVOKE ALL ON FUNCTION public.set_group_leader(uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.set_group_leader(uuid,uuid) TO authenticated;

-- ============================================================
-- 4. Poll deletion of own vote is allowed only while the poll is open.
-- ============================================================
DROP POLICY IF EXISTS poll_votes_delete_own ON public.poll_votes;
CREATE POLICY poll_votes_delete_own_open
ON public.poll_votes FOR DELETE TO authenticated
USING (
  user_id=auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.id=poll_id
      AND p.closed=false
      AND (p.closes_at IS NULL OR p.closes_at>now())
  )
);

-- ============================================================
-- 5. Final product invariants: no attendance objects must exist.
--    This is a guard for databases upgraded from old versions.
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.attendance_sessions') IS NOT NULL
     OR to_regclass('public.attendance_records') IS NOT NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_SCHEMA_STILL_PRESENT';
  END IF;
END $$;

-- End of phase 1 authorization hardening.
