-- Student Hub v1.6.0 — server-side deadline reminders.
-- This function is intentionally NOT auto-scheduled because pg_cron is an
-- optional project feature. After enabling pg_cron, schedule it every 15 min.

CREATE OR REPLACE FUNCTION public.generate_assignment_deadline_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH reminder_windows AS (
    SELECT '24h'::text AS slot, now() + interval '23 hours 45 minutes' AS from_at, now() + interval '24 hours 15 minutes' AS to_at
    UNION ALL
    SELECT '3h'::text, now() + interval '2 hours 45 minutes', now() + interval '3 hours 15 minutes'
  ),
  candidates AS (
    SELECT a.id, a.class_id, a.created_by, a.title, a.deadline, w.slot
    FROM public.assignments a
    JOIN reminder_windows w ON a.deadline > w.from_at AND a.deadline <= w.to_at
    WHERE a.deleted_at IS NULL
      AND a.deadline IS NOT NULL
  )
  INSERT INTO public.notifications(user_id, notification_type, title, body, data)
  SELECT
    cm.user_id,
    'assignment',
    CASE c.slot WHEN '24h' THEN 'Deadline tugas besok' ELSE 'Deadline tugas 3 jam lagi' END,
    c.title || ' · ' || to_char(c.deadline AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI'),
    jsonb_build_object(
      'assignment_id', c.id,
      'class_id', c.class_id,
      'reminder_key', 'assignment:' || c.id::text || ':' || c.slot
    )
  FROM candidates c
  JOIN public.class_members cm ON cm.class_id = c.class_id AND cm.status = 'active'
  WHERE cm.user_id <> c.created_by
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = cm.user_id
        AND n.notification_type = 'assignment'
        AND n.data->>'reminder_key' = 'assignment:' || c.id::text || ':' || c.slot
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_assignment_deadline_notifications() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.generate_assignment_deadline_notifications() IS
  'Creates deduplicated 24-hour and 3-hour assignment reminder notification rows. Schedule with Supabase Cron every 15 minutes after enabling pg_cron.';
