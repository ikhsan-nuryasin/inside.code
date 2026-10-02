# Inside Code v1.8.6

Production-ready React/Vite PWA for the Inside Code student class platform.

After deploying this version, hard-refresh the browser once so the updated Service Worker and frontend build are loaded.

The new Supabase migration is `031_normalize_legacy_branding.sql`. It only changes the app settings row if the stored application name is still the legacy `Student Hub` value; custom branding is preserved.
