-- Student Hub v1.6.0 — browser Web Push subscriptions.
-- Web Push is optional per device and user-controlled.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  device_label text,
  enabled boolean NOT NULL DEFAULT true,
  preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'assignment', true,
    'schedule', true,
    'forum', true,
    'material', true,
    'announcement', true,
    'cash', true,
    'group', true,
    'poll', true,
    'documentation', true,
    'system', true
  ),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  last_error text,
  fail_count integer NOT NULL DEFAULT 0 CHECK (fail_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_enabled_idx
  ON public.push_subscriptions(user_id, enabled, updated_at DESC);

CREATE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx
  ON public.push_subscriptions(endpoint);

DROP TRIGGER IF EXISTS push_subscriptions_set_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_set_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
ON public.push_subscriptions FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own
ON public.push_subscriptions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own
ON public.push_subscriptions FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
ON public.push_subscriptions FOR DELETE TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

COMMENT ON TABLE public.push_subscriptions IS
  'Per-device Web Push subscriptions. Endpoint/keys are treated as sensitive capability data and are only visible to the owning user or privileged server functions.';
