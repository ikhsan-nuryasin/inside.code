-- Inside Code v1.8.15
-- Follow-up to migration 033.
-- 033 correctly tightened direct access to internal functions, but several
-- helpers are also invoked by RLS/storage policies that execute as the
-- authenticated browser role. Restore EXECUTE for those policy dependencies.
-- Also remove the legacy class_members.role='admin' path from global app admin.

BEGIN;

-- ============================================================
-- 1. RLS / storage policy dependencies must remain executable by
-- authenticated callers. This does NOT expose table data; each helper
-- returns only a boolean and remains SECURITY DEFINER with pinned search_path.
-- ============================================================
GRANT EXECUTE ON FUNCTION public.can_manage_cash(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_documentation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_groups(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_secretary_features(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_class_position(uuid, public.class_position) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assignment_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_admin_from_text(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_leadership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member_from_text(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_material_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_subject_member(uuid) TO authenticated;

-- ============================================================
-- 2. Global app admin must come only from system_admins.
-- Legacy class_members.role='admin' is historical data and must not
-- grant global administrative authority.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_admins sa
    WHERE sa.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- Direct member role mutation is legacy and is not a supported authority
-- path anymore. Class officers are assigned via dedicated position RPCs.
DROP POLICY IF EXISTS class_members_update_admin ON public.class_members;

COMMIT;
