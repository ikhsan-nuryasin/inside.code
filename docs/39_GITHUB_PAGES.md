# GitHub Pages

Student Hub uses hash-based navigation, so it does not need an HTTP SPA rewrite for normal application routes.

For GitHub Pages, build `web` with production Supabase variables and publish `web/dist` using GitHub Actions or a static deployment action.

Recommended environment variables in GitHub repository Actions secrets/variables:

```text
VITE_DEMO_MODE=false
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

For a custom domain at the repository root, the normal `/` base is suitable. Hosting under a non-root subpath requires aligning the Vite `base` setting, PWA manifest paths, and service-worker scope before deployment.
