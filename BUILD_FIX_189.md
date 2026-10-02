# Inside Code v1.8.9 — Production Build Fix

The previous Cloudflare failure was caused by `npm ci` validating a stale/inconsistent package-lock state.

This release package intentionally does not ship a stale lockfile. Cloudflare Workers Builds should use:

Build variable:
`SKIP_DEPENDENCY_INSTALL=true`

Build command:
`npm install --no-audit --no-fund && npm run build`

Deploy command:
`npx wrangler deploy`

Project root:
`web`

This uses the current `package.json` as the dependency source and prevents the old `npm ci` lockfile mismatch from recurring.
