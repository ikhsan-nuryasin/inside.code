-- Inside Code v1.8.15
-- Security hardening: prevent signed-in browser roles from directly
-- executing SECURITY DEFINER helper functions that are used internally
-- by RLS/policy logic or server-side database logic.
--
-- This migration intentionally does NOT revoke EXECUTE from RPC functions
-- that are called directly by the Inside Code frontend.
--
-- SECURITY DEFINER is retained where the function is required for RLS or
-- privileged database operations. Existing pinned search_path settings are
-- preserved; this migration only tightens function EXECUTE privileges.

BEGIN;

-- ============================================================
-- 1. Internal authorization/helper functions
-- ============================================================
-- These functions are not called directly by the Inside Code frontend.
-- They may still be called from policies or other SECURITY DEFINER
-- database functions. Removing Data API EXECUTE prevents direct RPC access.

REVOKE EXECUTE ON FUNCTION public.can_manage_cash(uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_manage_documentation(uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_manage_group(uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_manage_groups(uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_manage_secretary_features(uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_class_position(uuid, public.class_position)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_assignment_member(uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_class_admin(uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_class_admin_from_text(text)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_class_leadership(uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_class_member_from_text(text)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_material_member(uuid)
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_subject_member(uuid)
  FROM public, anon, authenticated;

COMMIT;

-- Intentionally retained authenticated EXECUTE:
--   public.is_app_admin()
--   public.assign_class_position(...)
--   public.correct_cash_transaction(...)
--   public.pull_sync_events(...)
--   public.remove_class_position(...)
--   public.set_group_leader(...)
--   public.verify_cash_payment(...)
--   public.void_cash_transaction(...)
--
-- These are direct application RPCs in the current frontend and should not
-- be disabled by this hardening migration.
