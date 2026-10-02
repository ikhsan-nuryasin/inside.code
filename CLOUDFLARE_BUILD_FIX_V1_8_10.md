# Inside Code v1.8.10 — Cloudflare Build Fix

## Fixed TypeScript errors
1. `src/lib/captcha.ts`: explicit `Promise<void>` and return of a non-optional local promise.
2. `src/main.tsx`: normalize Service Worker ready registration to a Promise before `.then()`.
3. `package.json`: pin `@types/react` and `@types/react-dom` to `19.3.0`.
4. `build` no longer runs `prebuild` twice; npm lifecycle runs `prebuild` automatically.

## Local verification
Run from `web`: `npm install` then `npm run build`.

## Permanent lockfile fix
After `npm install`, commit the generated `web/package-lock.json` together with `web/package.json`.
Then Cloudflare can safely use `npm ci`.

## Temporary Cloudflare workaround
Until the regenerated lockfile is pushed, set `SKIP_DEPENDENCY_INSTALL=true` and use build command:
`npm install --no-audit --no-fund && npm run build`

## Do not commit
`.env`, service-role keys, Turnstile secret, VAPID private key, database passwords, or webhook secrets.
