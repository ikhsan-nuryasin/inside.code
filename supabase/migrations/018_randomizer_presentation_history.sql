-- Student Hub v1.1.5 — class randomizer + presentation order history.
-- No attendance or class creation/joining features are introduced.

CREATE TABLE IF NOT EXISTS public.randomizer_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('group_leader','presentation_order','member_random')),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  entries jsonb NOT NULL CHECK (jsonb_typeof(entries) = 'array' AND jsonb_array_length(entries) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS randomizer_results_class_date_idx
  ON public.randomizer_results(class_id, created_at DESC);

ALTER TABLE public.randomizer_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS randomizer_results_select_member ON public.randomizer_results;
CREATE POLICY randomizer_results_select_member ON public.randomizer_results
FOR SELECT TO authenticated USING (public.is_class_member(class_id));
DROP POLICY IF EXISTS randomizer_results_insert_leadership ON public.randomizer_results;
CREATE POLICY randomizer_results_insert_leadership ON public.randomizer_results
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.is_class_member(class_id));
DROP POLICY IF EXISTS randomizer_results_delete_leadership ON public.randomizer_results;
CREATE POLICY randomizer_results_delete_leadership ON public.randomizer_results
FOR DELETE TO authenticated USING (public.is_class_leadership(class_id));


-- Include randomizer changes in the Phase 3 incremental sync feed.
DROP TRIGGER IF EXISTS trg_sync_randomizer_results ON public.randomizer_results;
CREATE TRIGGER trg_sync_randomizer_results
AFTER INSERT OR UPDATE OR DELETE ON public.randomizer_results
FOR EACH ROW EXECUTE FUNCTION public.capture_sync_event();
