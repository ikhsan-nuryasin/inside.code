-- Student Hub v1.6.0 — server-side notification coverage.
-- Adds in-app notifications for materials, schedule changes, polls,
-- class events, and cash payment status changes so the Web Push pipeline
-- can deliver the same events outside the app.

CREATE OR REPLACE FUNCTION public.notify_material_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.notify_class_members(
    new.class_id,
    'material',
    'Materi baru: ' || new.title,
    COALESCE(NULLIF(trim(new.description), ''), 'Materi baru telah ditambahkan ke kelas.'),
    jsonb_build_object('material_id', new.id, 'class_id', new.class_id),
    new.created_by
  );
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_material_created() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS materials_notify_created ON public.materials;
CREATE TRIGGER materials_notify_created
AFTER INSERT ON public.materials
FOR EACH ROW EXECUTE FUNCTION public.notify_material_created();

CREATE OR REPLACE FUNCTION public.notify_schedule_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_class_id uuid;
  v_subject_name text;
  v_day_name text;
BEGIN
  SELECT s.class_id, s.name INTO v_class_id, v_subject_name
  FROM public.subjects s
  WHERE s.id = COALESCE(new.subject_id, old.subject_id)
  LIMIT 1;

  v_day_name := CASE COALESCE(new.day_of_week, old.day_of_week)
    WHEN 1 THEN 'Senin' WHEN 2 THEN 'Selasa' WHEN 3 THEN 'Rabu'
    WHEN 4 THEN 'Kamis' WHEN 5 THEN 'Jumat' WHEN 6 THEN 'Sabtu' WHEN 7 THEN 'Minggu'
    ELSE 'Jadwal'
  END;

  PERFORM private.notify_class_members(
    v_class_id,
    'schedule',
    CASE WHEN TG_OP = 'INSERT' THEN 'Jadwal baru: ' || COALESCE(v_subject_name, 'Mata kuliah') ELSE 'Jadwal diperbarui: ' || COALESCE(v_subject_name, 'Mata kuliah') END,
    v_day_name || ' · ' || to_char(COALESCE(new.starts_at, old.starts_at), 'HH24:MI') || '–' || to_char(COALESCE(new.ends_at, old.ends_at), 'HH24:MI'),
    jsonb_build_object('schedule_id', COALESCE(new.id, old.id), 'class_id', v_class_id),
    auth.uid()
  );
  RETURN COALESCE(new, old);
END;
$$;
REVOKE ALL ON FUNCTION public.notify_schedule_changed() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS schedules_notify_changed ON public.schedules;
CREATE TRIGGER schedules_notify_changed
AFTER INSERT OR UPDATE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.notify_schedule_changed();

CREATE OR REPLACE FUNCTION public.notify_poll_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.notify_class_members(
    new.class_id,
    'poll',
    'Polling baru: ' || new.title,
    COALESCE(NULLIF(trim(new.description), ''), 'Polling baru tersedia di kelas.'),
    jsonb_build_object('poll_id', new.id, 'class_id', new.class_id),
    new.created_by
  );
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_poll_created() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS polls_notify_created ON public.polls;
CREATE TRIGGER polls_notify_created
AFTER INSERT ON public.polls
FOR EACH ROW EXECUTE FUNCTION public.notify_poll_created();

CREATE OR REPLACE FUNCTION public.notify_class_event_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.notify_class_members(
    new.class_id,
    CASE WHEN new.event_type = 'presentation' THEN 'group'::public.notification_type ELSE 'schedule'::public.notification_type END,
    'Agenda kelas: ' || new.title,
    to_char(new.starts_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI'),
    jsonb_build_object('event_id', new.id, 'class_id', new.class_id, 'event_type', new.event_type),
    new.created_by
  );
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_class_event_created() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS class_events_notify_created ON public.class_events;
CREATE TRIGGER class_events_notify_created
AFTER INSERT ON public.class_events
FOR EACH ROW EXECUTE FUNCTION public.notify_class_event_created();

CREATE OR REPLACE FUNCTION public.notify_cash_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_title text;
  v_body text;
  v_class_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND new.status IS DISTINCT FROM old.status THEN
    SELECT class_id INTO v_class_id FROM public.cash_dues WHERE id = COALESCE(new.due_id, old.due_id);
    v_title := CASE COALESCE(new.status, old.status)::text
      WHEN 'paid' THEN 'Pembayaran kas diverifikasi'
      WHEN 'partial' THEN 'Pembayaran kas sebagian diterima'
      WHEN 'rejected' THEN 'Pembayaran kas ditolak'
      ELSE 'Status pembayaran kas diperbarui'
    END;
    v_body := 'Nominal: Rp' || to_char(COALESCE(new.amount, old.amount), 'FM999G999G999G990D00')
      || CASE WHEN v_class_id IS NOT NULL THEN ' · Periksa detail pembayaran di Kas.' ELSE '' END;

    INSERT INTO public.notifications(user_id, notification_type, title, body, data)
    VALUES (
      COALESCE(new.user_id, old.user_id),
      'cash',
      left(v_title, 200),
      v_body,
      jsonb_build_object('cashPaymentId', COALESCE(new.id, old.id), 'dueId', COALESCE(new.due_id, old.due_id), 'classId', v_class_id)
    );
  END IF;
  RETURN COALESCE(new, old);
END;
$$;
REVOKE ALL ON FUNCTION public.notify_cash_payment_status() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS cash_payments_notify_status ON public.cash_payments;
CREATE TRIGGER cash_payments_notify_status
AFTER INSERT OR UPDATE OF status ON public.cash_payments
FOR EACH ROW EXECUTE FUNCTION public.notify_cash_payment_status();

-- Upgrade the existing forum reply payload to include class_id so deep links
-- work from both popup and system notification.
CREATE OR REPLACE FUNCTION public.notify_forum_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_class_id uuid;
  v_topic_title text;
BEGIN
  SELECT t.class_id, t.title INTO v_class_id, v_topic_title
  FROM public.forum_topics t WHERE t.id = new.topic_id;
  IF new.parent_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,notification_type,title,body,data)
    SELECT p.user_id,
      'forum',
      'Balasan forum: ' || v_topic_title,
      left(new.content,300),
      jsonb_build_object('topic_id',new.topic_id,'post_id',new.id,'class_id',v_class_id)
    FROM public.forum_posts p
    WHERE p.id = new.parent_id
      AND p.user_id <> new.user_id;
  END IF;
  RETURN new;
END;
$$;
DROP TRIGGER IF EXISTS forum_posts_notify_reply ON public.forum_posts;
CREATE TRIGGER forum_posts_notify_reply
AFTER INSERT ON public.forum_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_forum_reply();
