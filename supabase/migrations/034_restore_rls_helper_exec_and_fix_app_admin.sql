-- Inside Code v1.8.15 corrective security migration
-- 1) Restore EXECUTE to public helper functions used by RLS policies.
--    PostgreSQL still checks EXECUTE when an RLS policy invokes a function,
--    so revoking these privileges breaks legitimate authenticated queries.
-- 2) Remove legacy class_members.role='admin' as a source of global app-admin
--    privilege. Global application administration comes only from system_admins.

BEGIN;

-- RLS authorization helpers: required by existing policies for authenticated users.
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

REVOKE EXECUTE ON FUNCTION public.is_app_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

COMMIT;
