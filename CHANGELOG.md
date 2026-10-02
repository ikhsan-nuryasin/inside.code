# Inside Code Changelog

## 1.8.6
- Fixed registration/login to validate the actual submitted form values, including browser/password-manager autofill values.
- Added named form fields and a shared password policy check so the live checklist and submit validation use the same source.
- Password errors now identify the unmet requirements instead of falsely rejecting a valid password because React state was stale.

## 1.8.5
- Fixed the stray `0` on auth when the login lock is inactive.
- Added live registration password requirement indicators.
- Normalized legacy `Student Hub` database branding to `Inside Code` without overwriting custom branding.
- Bumped Service Worker cache to 1.8.5.
- Supabase deployment continues to use `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.
