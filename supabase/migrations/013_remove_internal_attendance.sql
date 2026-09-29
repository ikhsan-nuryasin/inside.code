-- ============================================================
-- v1.0.7: Remove ALL internal attendance functionality.
-- The official campus attendance remains outside Student Hub.
-- This migration is idempotent and cleans databases that previously
-- applied v1.0.6 attendance migrations.
-- ============================================================

DROP FUNCTION IF EXISTS public.create_attendance_session CASCADE;
DROP FUNCTION IF EXISTS public.set_attendance_record CASCADE;
DROP FUNCTION IF EXISTS public.close_attendance_session CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_attendance CASCADE;

DROP TABLE IF EXISTS public.attendance_records CASCADE;
DROP TABLE IF EXISTS public.attendance_sessions CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='attendance_status'
  ) THEN
    DROP TYPE public.attendance_status;
  END IF;
END $$;
