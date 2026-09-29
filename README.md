# Student Hub PWA v1.8.1 — Production Clean

Clean production source package for the Student Hub React/Vite + Supabase PWA.

## Stack
- React 19
- TypeScript 5.8
- Vite 8
- Supabase Auth, Postgres, RLS, Storage, Realtime
- IndexedDB offline cache/outbox
- Web Push + VAPID
- Cloudflare Turnstile
- Cloudflare Workers static assets + SPA fallback

## Product rules
- No attendance/presence module.
- No lecturer role/module.
- No self-service class creation.
- No self-service class joining.
- Classes and memberships are provisioned by the controlled operator/database workflow.

## Project structure
```text
student_hub/
├── supabase/
│   ├── functions/
│   └── migrations/        # 001–027, run in order
└── web/
    ├── src/
    ├── public/
    ├── package.json
    ├── vite.config.ts
    └── wrangler.jsonc
```

## Local setup
```powershell
cd web
copy .env.example .env.local
npm install
npm run typecheck
npm run build
npm run dev
```

For production, `VITE_DEMO_MODE=false`, a valid Supabase URL/publishable key, VAPID public key, and Turnstile site key are required by the production guard.

## Cloudflare Workers
Use Workers Builds with:
- Production branch: `main`
- Root directory: `web`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Set production build variables in Cloudflare:
```text
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VITE_CAPTCHA_REQUIRED=true
VITE_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
```

Never put service-role keys, Turnstile secret keys, VAPID private JWKs, webhook secrets, or database passwords in frontend `VITE_*` variables.

See `CLOUDFLARE_WORKERS_DEPLOY.md` and `SUPABASE_PRODUCTION.md`.

## Database
Apply `supabase/migrations/001_*.sql` through `027_*.sql` in numeric order in the target Supabase project.

## Important cleanup
This package intentionally excludes:
- Git history and `.git/`
- `.env` files and local secrets
- `node_modules/`
- `dist/` and caches
- old Vercel/Netlify/cPanel hosting configs
- historical release notes and duplicate changelogs
- audit/verification scripts not required by the production build
- local batch helper scripts
- generated TypeScript build-info files

The current Git repository can keep its existing `web/package-lock.json`; this clean source package does not fabricate a lockfile.
