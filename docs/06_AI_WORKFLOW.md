# AI Coding Workflow

Give the AI these files first:
1. `AI_IMPLEMENTATION_CONTEXT.md`
2. `docs/02_ARCHITECTURE.md`
3. `docs/04_OFFLINE_SYNC.md`
4. `supabase/migrations/*.sql`
5. Relevant source file being edited.

## Rules for AI
- Do not invent a new table if an existing table can represent the data.
- Do not rename tables/columns without updating every consumer and SQL migration.
- Do not bypass RLS.
- Do not put secrets in frontend code.
- Do not replace IndexedDB with localStorage for structured app data.
- Do not add a second backend.
- Keep PWA installability working.
- When fixing a bug, state exact root cause and exact files changed.
