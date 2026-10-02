-- Inside Code v1.8.4
-- Security hardening based on the Supabase security linter output observed
-- after migrations 001-029 were deployed.
--
-- Scope:
--   1) Pin search_path for public trigger/helper functions that previously
--      had no explicit function-level search_path.
--   2) Remove Data API execution privileges from trigger/internal SECURITY
--      DEFINER functions that do not need to be called by browser roles.
--
-- Intentional SECURITY DEFINER RPCs used by the application remain available
-- to authenticated users when required by their existing grants/RLS rules.

BEGIN;

-- ============================================================
-- 1. Pin search_path on functions reported as mutable.
-- These functions reference application objects in public and therefore
-- explicitly pin the lookup path to public rather than inheriting the caller
-- session's search_path.
-- ============================================================

ALTER FUNCTION public.set_updated_at()
  SET search_path = public;

ALTER FUNCTION public.validate_group_task_assignee()
  SET search_path = public;

ALTER FUNCTION public.validate_poll_vote_option()
  SET search_path = public;

ALTER FUNCTION public.validate_material_file()
  SET search_path = public;

ALTER FUNCTION public.validate_forum_post_file()
  SET search_path = public;

ALTER FUNCTION public.validate_photo_file()
  SET search_path = public;

ALTER FUNCTION public.validate_cash_proof_file()
  SET search_path = public;

ALTER FUNCTION public.validate_cash_payment_proof_file()
  SET search_path = public;

ALTER FUNCTION public.validate_assignment_subject()
  SET search_path = public;

ALTER FUNCTION public.validate_material_subject()
  SET search_path = public;

ALTER FUNCTION public.protect_file_identity()
  SET search_path = public;

ALTER FUNCTION public.validate_forum_report_post_topic()
  SET search_path = public;

ALTER FUNCTION public.guard_forum_topic_update()
  SET search_path = public;

ALTER FUNCTION public.validate_group_leader_membership()
  SET search_path = public;

-- ============================================================
-- 2. Trigger/internal SECURITY DEFINER functions must not be callable
-- directly through the Data API by anonymous or signed-in browser roles.
-- PostgreSQL triggers can execute these functions without granting EXECUTE
-- to the caller role.
-- ============================================================

REVOKE ALL ON FUNCTION public.capture_sync_event()
  FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_event_class_id(text, uuid, uuid, uuid)
  FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.log_class_activity()
  FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_cash_payment_update()
  FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_group_leader()
  FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_group_task_member_update()
  FROM public, anon, authenticated;

-- is_app_admin() is intentionally retained for authenticated callers because
-- the frontend uses it to determine access to the global Admin page.
REVOKE EXECUTE ON FUNCTION public.is_app_admin()
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin()
  TO authenticated;

COMMIT;
