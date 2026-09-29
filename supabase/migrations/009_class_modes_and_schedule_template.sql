-- Student Hub v1.0.5
-- Class delivery mode (offline/online) and the schedule template transcribed from the supplied image.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'class_delivery_mode') THEN
    CREATE TYPE public.class_delivery_mode AS ENUM ('offline','online');
  END IF;
END
$$;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS delivery_mode public.class_delivery_mode NOT NULL DEFAULT 'offline';

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS lecturer_code text,
  ADD COLUMN IF NOT EXISTS lecturer_code_secondary text,
  ADD COLUMN IF NOT EXISTS credits smallint,
  ADD COLUMN IF NOT EXISTS practical_group text;

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_credits_check;
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_credits_check CHECK (credits IS NULL OR credits BETWEEN 1 AND 6);

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS meeting_url text;

CREATE UNIQUE INDEX IF NOT EXISTS subjects_class_code_uidx
  ON public.subjects (class_id, code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS schedules_subject_slot_uidx
  ON public.schedules (subject_id, day_of_week, starts_at, ends_at)
  WHERE deleted_at IS NULL;

-- Remove the direct INSERT route for classes. Creation goes through the validated RPC below.
DROP POLICY IF EXISTS classes_insert_own ON public.classes;

DROP FUNCTION IF EXISTS public.create_class(text, text, integer, text, text);

CREATE OR REPLACE FUNCTION public.create_class(
    p_name text,
    p_delivery_mode public.class_delivery_mode DEFAULT 'offline',
    p_study_program text DEFAULT NULL,
    p_semester integer DEFAULT NULL,
    p_academic_year text DEFAULT NULL,
    p_description text DEFAULT NULL
)
RETURNS public.classes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_code text;
    v_class public.classes;
    attempts integer := 0;
BEGIN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'UNAUTHENTICATED';
    END IF;

    IF length(trim(coalesce(p_name,''))) = 0 THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'CLASS_NAME_REQUIRED';
    END IF;

    IF p_semester IS NOT NULL AND (p_semester < 1 OR p_semester > 20) THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'INVALID_SEMESTER';
    END IF;

    LOOP
      attempts := attempts + 1;
      v_code := private.random_class_code(10);
      BEGIN
        INSERT INTO public.classes (
          name, class_code, delivery_mode, study_program, semester, academic_year, description, created_by
        ) VALUES (
          trim(p_name), v_code, p_delivery_mode, nullif(trim(p_study_program), ''), p_semester,
          nullif(trim(p_academic_year), ''), nullif(trim(p_description), ''), auth.uid()
        ) RETURNING * INTO v_class;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempts >= 10 THEN
          RAISE EXCEPTION USING errcode='P0001', message='CLASS_CODE_GENERATION_FAILED';
        END IF;
      END;
    END LOOP;

    RETURN v_class;
END;
$$;

REVOKE ALL ON FUNCTION public.create_class(text, public.class_delivery_mode, text, integer, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_class(text, public.class_delivery_mode, text, integer, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_schedule_template(p_class_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_subject_id uuid;
  v_mode public.class_delivery_mode;
  r record;
BEGIN
  IF NOT public.is_class_admin(p_class_id) THEN
    RAISE EXCEPTION USING errcode='P0001', message='CLASS_ADMIN_REQUIRED';
  END IF;

  SELECT delivery_mode INTO v_mode FROM public.classes WHERE id = p_class_id AND deleted_at IS NULL;

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
    DO UPDATE SET name=excluded.name, lecturer_code=excluded.lecturer_code, credits=excluded.credits, practical_group=excluded.practical_group, deleted_at=NULL
    RETURNING id INTO v_subject_id;

    INSERT INTO public.schedules(subject_id,day_of_week,starts_at,ends_at,room,location,meeting_url,notes)
    VALUES(v_subject_id,r.day_of_week,r.starts_at,r.ends_at,CASE WHEN v_mode='offline' THEN r.room ELSE NULL END,NULL,NULL,NULL)
    ON CONFLICT (subject_id,day_of_week,starts_at,ends_at) WHERE deleted_at IS NULL
    DO UPDATE SET room=excluded.room, location=NULL, meeting_url=NULL, notes=NULL, deleted_at=NULL;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_schedule_template(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_schedule_template(uuid) TO authenticated;
