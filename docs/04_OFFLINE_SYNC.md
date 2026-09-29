# Offline Sync Contract

## Local stores
- `cache`: latest successful server snapshots.
- `sync_queue`: pending mutation records.
- `meta`: last sync timestamp and app metadata.

## Queue item
```json
{
  "operationId": "uuid",
  "table": "personal_notes",
  "operation": "upsert",
  "entityId": "uuid",
  "payload": {},
  "status": "pending",
  "attempts": 0,
  "createdAt": 0,
  "updatedAt": 0
}
```

## Rules
1. Local UI must update optimistically where safe.
2. A mutation is not considered server-synced until Supabase confirms success.
3. Failed mutation stays in queue with error message.
4. Retry uses backoff at application layer.
5. Avoid duplicate writes with stable `operationId` or idempotent upsert constraints.
6. Use `updated_at` for normal synchronization.
7. Shared resources that can conflict should use version/conditional update RPC.
