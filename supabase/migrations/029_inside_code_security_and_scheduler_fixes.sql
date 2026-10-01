-- Inside Code v1.8.3 hardening
-- Explicit privileges, branding storage scoping, and optional assignment reminder scheduling.

grant select on public.app_settings to anon, authenticated;
update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp'],
    file_size_limit = 2097152,
    public = true
where id = 'app-assets';

grant update on public.app_settings to authenticated;
grant select on public.system_admins to authenticated;

drop policy if exists app_assets_public_read on storage.objects;
create policy app_assets_public_read
on storage.objects for select
using (bucket_id = 'app-assets' and name like 'branding/%');

drop policy if exists app_assets_admin_insert on storage.objects;
create policy app_assets_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'app-assets' and name like 'branding/%' and public.is_app_admin());

drop policy if exists app_assets_admin_update on storage.objects;
create policy app_assets_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'app-assets' and name like 'branding/%' and public.is_app_admin())
with check (bucket_id = 'app-assets' and name like 'branding/%' and public.is_app_admin());

drop policy if exists app_assets_admin_delete on storage.objects;
create policy app_assets_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'app-assets' and name like 'branding/%' and public.is_app_admin());

-- pg_cron is optional on Supabase projects. The migration never fails when the
-- extension has not been enabled; when cron.job exists, it creates one idempotent job.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    SELECT jobid INTO v_job_id
    FROM cron.job
    WHERE jobname = 'inside-code-assignment-reminders'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'inside-code-assignment-reminders',
      '*/15 * * * *',
      'select public.generate_assignment_deadline_notifications();'
    );
  ELSE
    RAISE NOTICE 'Inside Code: pg_cron is not enabled; assignment reminders are not scheduled yet.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Inside Code: pg_cron scheduler setup skipped: %', SQLERRM;
END $$;
