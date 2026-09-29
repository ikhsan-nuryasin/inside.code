# Fix npm ERESOLVE — @vitejs/plugin-react vs Vite

## Error

If `npm install` shows:

`vite@8.x` together with `@vitejs/plugin-react@5.x` and says the plugin only accepts Vite `^4 || ^5 || ^6 || ^7`, the dependency versions are mismatched.

## Cause

This project uses Vite 8. The original package pinned `@vitejs/plugin-react` 5.0.4, whose peer range does not include Vite 8. Vite 8 was released together with `@vitejs/plugin-react` v6. The project is now pinned to `@vitejs/plugin-react` 6.1.1.

## Correct fix

Do NOT use `--force` or `--legacy-peer-deps` for this project. Those options can hide a real dependency mismatch.

From:

`C:\xampp\htdocs\student_hub_pwa_v1_0_0\web`

run:

```powershell
node -v
npm -v
npm install
npm run typecheck
npm run build
npm run dev
```

Node must be 20.19.0 or newer for the current Vite 8 setup.

If Node is older, install a current Node LTS, open a new PowerShell window, and run the commands again.

## If a stale install exists

If `node_modules` or `package-lock.json` was created by the broken dependency set, clean them first:

```powershell
cd C:\xampp\htdocs\student_hub_pwa_v1_0_0\web
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
```

## Expected dependency core

- React 19.3.0
- React DOM 19.3.0
- Vite 8.3.1
- @vitejs/plugin-react 6.1.1
- TypeScript 5.8.3
- @supabase/supabase-js 2.117.1

## Fix TypeScript TS18047 in `src/lib/repository.ts`

If `npm run build` fails with:

`TS18047: 'supabase' is possibly 'null'`

at the cleanup line inside `subscribeRealtime()`, use a narrowed local reference. The fixed code is:

```ts
export async function subscribeRealtime(onChange: () => void) {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel('student-hub-events')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, onChange)
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
```

Do not silence the error with a non-null assertion (`supabase!`) unless there is a verified invariant. The local `client` reference keeps TypeScript's null narrowing valid for the returned cleanup closure.
