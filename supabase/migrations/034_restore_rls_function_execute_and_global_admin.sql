-- Inside Code v1.8.16
-- Repair migration 033 privilege changes that accidentally revoked EXECUTE
-- from helper functions required by RLS policy expressions.
-- Also remove the legacy class_members.role='admin' path from global
-- application-admin authorization. Global administration is sourced only
-- from public.system_admins.

BEGIN;

-- ============================================================
-- 1. RLS helper functions: callable by authenticated queries so the RLS
--    policies can evaluate them. Keep anonymous/public execution blocked.
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

REVOKE EXECUTE ON FUNCTION public.can_manage_cash(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_documentation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_group(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_groups(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_secretary_features(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_class_position(uuid, public.class_position) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_assignment_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_class_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_class_admin_from_text(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_class_leadership(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_class_member_from_text(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_material_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_subject_member(uuid) FROM anon;

-- ============================================================
-- 2. Global administrator authorization must come only from the
--    dedicated system_admins table. Legacy class member roles never grant
--    global privileges.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_admins sa
    WHERE sa.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

COMMIT;
