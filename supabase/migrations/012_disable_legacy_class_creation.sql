-- Inside Code v1.8.3 migration 012
-- Final self-service class workflow lock.
--
-- IMPORTANT:
-- Migration 009 intentionally removed the legacy
-- create_class(text,text,integer,text,text) overload and replaced it with
-- create_class(text,class_delivery_mode,text,integer,text,text).
-- Therefore the old overload may not exist when this migration runs.
-- Revoke only existing functions so a fresh production database can apply
-- the migration chain without failing on a missing overload.

DO $$
BEGIN
  IF to_regprocedure('public.create_class(text, text, integer, text, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_class(text, text, integer, text, text)
      FROM public, anon, authenticated;
  END IF;

  IF to_regprocedure('public.create_class(text, public.class_delivery_mode, text, integer, text, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_class(text, public.class_delivery_mode, text, integer, text, text)
      FROM public, anon, authenticated;
  END IF;

  IF to_regprocedure('public.join_class_by_code(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.join_class_by_code(text)
      FROM public, anon, authenticated;
  END IF;
END
$$;

-- The application intentionally provisions classes and memberships outside
-- the student client. Operators may still execute SQL directly as database
-- owners/service-role processes where appropriate.
