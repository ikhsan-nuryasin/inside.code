# Inside Code v1.8.11

## Auth verification redirect fix

- Registration now passes `emailRedirectTo: window.location.origin` so Supabase confirmation emails return to the same origin that generated the signup link.
- This fixes local development redirecting to the default `http://localhost:3000` when the app is running on another Vite port.
- Production naturally redirects back to the deployed app origin.
- Password reset already used a dynamic origin and remains unchanged.

## Required Supabase Redirect URLs
Add both the local and production origins to Authentication → URL Configuration → Redirect URLs, for example:

- `http://localhost:5173`
- `https://inside-code.yasinikhhsan2.workers.dev`

Generate a fresh verification email after changing these settings. Old confirmation links may be single-use or expired.

## Build status
The source is intended to be built with the current project dependency set. Run `npm install`, `npm run typecheck`, then `npm run build` before deployment.
