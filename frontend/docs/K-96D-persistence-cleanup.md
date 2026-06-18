# K-96D — Persistence Cleanup & Storage Audit

Finishes the K-96 persistence stack by removing legacy storage debt, cleaning orphan keys, auditing usage, and tightening snapshot retention.

## Changes

| Area | Behavior |
|------|----------|
| **Audit** (`k96dPersistenceAudit.ts`) | Inventories localStorage keys, IndexedDB records, snapshot chunks, migration markers, revision keys |
| **Cleanup** (`persistenceCleanup.ts`) | `cleanupLegacyStorageKeys`, `cleanupPersistenceOrphans`, `runPersistenceCleanup` on startup |
| **Metrics** (`getPersistenceMetrics`) | Debug-only byte/count summary for audits |
| **Retention** (`vaultSnapshotConstants.ts`) | Daily 30, weekly 12, monthly 12; chunk keys removed with metadata |

## Protected localStorage keys

These are never removed by legacy cleanup:

- `note-active-v2`, `note-folders-v2` (folders/active)
- `notes-indexeddb-migrated-v1`, `notes-idb-rev-v1`
- `planner-storage`, workspace/history/preferences keys
- Snapshot index (`absinthe:vault-snapshot:index:v1`)

## Legacy keys removed (after migration success)

- `notes-v2` — after IndexedDB migration completes
- Pre-v2 noteview/planner keys (`noteview-notes-v1`, `planner-notes-v2`, …)
- Obsolete marker `notes-storage-migrated-v2`

## Orphan cleanup

`cleanupPersistenceOrphans()` removes:

- Snapshot chunks without metadata or incomplete chunk sets
- Metadata without matching chunks
- Indexed entries whose payloads cannot be loaded
- Unindexed snapshot storage keys

Safe and idempotent — called from `initNotesPersistence()` on every startup.

## Snapshot retention

| Slot | Max kept |
|------|----------|
| `last` | 1 |
| `daily` | 30 |
| `weekly` | 12 |
| `monthly` | 12 |

`saveVaultSnapshot()` prunes expired entries and deletes associated chunk/meta/payload keys together.

## Audit matrix

Run `npm test -- k96dPersistence` to print metrics at 100 / 300 / 1000 / 3000 notes:

- localStorage bytes (after cleanup)
- snapshot bytes
- IndexedDB record count
- orphan count (before cleanup)
- legacy key count (before cleanup)
- reclaimed bytes

## Cross-version safety

Tests verify:

- localStorage → IndexedDB migration (K-96B)
- Chunked snapshot load/restore (K-96C)
- Legacy single-blob snapshot compatibility
- Export/import manifest schema unchanged
- IndexedDB revision key updates on save (cross-tab)

## Verification

```bash
npm run typecheck
npm test
npm run build
npm test -- k96dPersistence
```

## Out of scope

Note schema, KnowledgeIndexService, graph, discovery, cloud sync protocol.

## After K-96D

Resume deferred K-95 optimization work:

- K-95B Link context optimization
- K-95C Knowledge index memory reduction
- K-95D Discovery candidate memory optimization
