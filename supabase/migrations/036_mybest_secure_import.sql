-- Inside Code v1.8.18
-- MyBest secure import bridge.
-- This does NOT store the user's MyBest password. The user logs into MyBest
-- manually and imports only the currently visible data through a short-lived
-- one-time import token.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mybest_import_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mybest_import_tokens_user_idx
  ON public.mybest_import_tokens(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mybest_import_tokens_expiry_idx
  ON public.mybest_import_tokens(expires_at);

ALTER TABLE public.mybest_import_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mybest_import_tokens_no_direct_select ON public.mybest_import_tokens;
DROP POLICY IF EXISTS mybest_import_tokens_no_direct_write ON public.mybest_import_tokens;

-- Tokens are created through a tightly scoped SECURITY DEFINER RPC and
-- consumed only by the Edge Function using the service role.

CREATE OR REPLACE FUNCTION public.create_mybest_import_token(
  p_token_hash text,
  p_expires_seconds integer DEFAULT 600
)
RETURNS TABLE(token_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_token_hash IS NULL OR length(trim(p_token_hash)) <> 64 THEN
    RAISE EXCEPTION 'invalid token hash';
  END IF;

  IF p_expires_seconds IS NULL OR p_expires_seconds < 60 OR p_expires_seconds > 900 THEN
    RAISE EXCEPTION 'invalid expiration';
  END IF;

  DELETE FROM public.mybest_import_tokens
  WHERE used_at IS NOT NULL OR expires_at < now();

  v_expires := now() + make_interval(secs => p_expires_seconds);

  INSERT INTO public.mybest_import_tokens(user_id, token_hash, expires_at)
  VALUES(auth.uid(), trim(p_token_hash), v_expires)
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN QUERY SELECT v_id, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.create_mybest_import_token(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_mybest_import_token(text, integer) TO authenticated;

CREATE TABLE IF NOT EXISTS public.mybest_sync_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  page_title text NULL,
  category text NOT NULL CHECK (category IN ('schedule','assignment','material','announcement','other')),
  captured_at timestamptz NOT NULL DEFAULT now(),
  checksum text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_url, checksum)
);

CREATE INDEX IF NOT EXISTS mybest_sync_documents_user_idx
  ON public.mybest_sync_documents(user_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS mybest_sync_documents_category_idx
  ON public.mybest_sync_documents(user_id, category, captured_at DESC);

ALTER TABLE public.mybest_sync_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mybest_sync_documents_select_own ON public.mybest_sync_documents;
CREATE POLICY mybest_sync_documents_select_own
  ON public.mybest_sync_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.mybest_sync_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NULL REFERENCES public.mybest_sync_documents(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('schedule','assignment','material','announcement','other')),
  source_key text NOT NULL,
  title text NOT NULL,
  source_url text NULL,
  starts_at timestamptz NULL,
  ends_at timestamptz NULL,
  due_at timestamptz NULL,
  subject text NULL,
  room text NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, kind, source_key)
);

CREATE INDEX IF NOT EXISTS mybest_sync_items_user_kind_idx
  ON public.mybest_sync_items(user_id, kind, captured_at DESC);

CREATE INDEX IF NOT EXISTS mybest_sync_items_due_idx
  ON public.mybest_sync_items(user_id, due_at)
  WHERE due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS mybest_sync_items_start_idx
  ON public.mybest_sync_items(user_id, starts_at)
  WHERE starts_at IS NOT NULL;

ALTER TABLE public.mybest_sync_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mybest_sync_items_select_own ON public.mybest_sync_items;
CREATE POLICY mybest_sync_items_select_own
  ON public.mybest_sync_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.mybest_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('success','failed')),
  source_url text NULL,
  imported_documents integer NOT NULL DEFAULT 0,
  imported_items integer NOT NULL DEFAULT 0,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mybest_sync_runs_user_idx
  ON public.mybest_sync_runs(user_id, created_at DESC);

ALTER TABLE public.mybest_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mybest_sync_runs_select_own ON public.mybest_sync_runs;
CREATE POLICY mybest_sync_runs_select_own
  ON public.mybest_sync_runs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.mybest_import_tokens IS
  'Short-lived one-time hashes used by the MyBest browser import bridge. No MyBest password is stored.';
COMMENT ON TABLE public.mybest_sync_documents IS
  'Raw page snapshots imported from MyBest after the user logs in manually.';
COMMENT ON TABLE public.mybest_sync_items IS
  'Normalized MyBest items extracted from imported page snapshots.';

COMMIT;
