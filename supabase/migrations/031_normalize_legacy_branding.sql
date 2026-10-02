-- Inside Code v1.8.5: normalize only the legacy default branding.
-- Custom administrator branding is preserved.

UPDATE public.app_settings
SET
  app_name = 'Inside Code',
  short_name = 'Inside Code',
  tagline = CASE
    WHEN lower(trim(tagline)) IN ('', 'student hub', 'ruang kelas mahasiswa')
      THEN 'Ruang kelas mahasiswa'
    ELSE tagline
  END
WHERE id = 1
  AND lower(trim(app_name)) = 'student hub';
