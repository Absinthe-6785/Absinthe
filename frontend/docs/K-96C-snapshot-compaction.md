# K-96C — Snapshot Compaction & Chunked Persistence

Reduces snapshot write amplification and memory churn while preserving restore/export compatibility.

## Changes

| Area | Behavior |
|------|----------|
| **Compaction** (`snapshotCompaction.ts`) | Omit deleted notes, strip `lastOpenedAt`, trim body whitespace, drop empty optional fields |
| **Chunked writes** (`vaultSnapshotStore.ts`) | Split serialized snapshot into ~384 KB chunks + meta key; legacy single-blob snapshots still load |
| **Scheduling** (`vaultSnapshotAuto.ts`) | 30s debounce retained; skip scheduling when content fingerprint matches last flushed snapshot; store still skips unchanged slot writes |

## Storage layout (new writes)

```
absinthe:vault-snapshot:meta:{snapshotId}:v1     → { storageFormat, chunkCount, totalBytes }
absinthe:vault-snapshot:chunk:{snapshotId}:0:v1  → payload slice
absinthe:vault-snapshot:chunk:{snapshotId}:1:v1  → payload slice
...
```

Legacy key `absinthe:vault-snapshot:payload:{snapshotId}:v1` is still read for older snapshots.

## Audit matrix

Run `npm test -- k96cSnapshot` to print compaction metrics at 100 / 300 / 1000 / 3000 notes:

- Snapshot bytes before (uncompacted manifest envelope)
- Snapshot bytes after (compacted vault snapshot)
- Chunk count and write count (meta + chunks)
- Deleted-note omission count at 10% trash ratio

## Backward compatibility

- Export/import vault manifest schema unchanged
- `parseVaultSnapshotJson` / `validateVaultSnapshot` unchanged
- Restore pipeline reads reassembled chunked payloads identically to legacy blobs
- `saveVaultSnapshot` still dedupes by `contentFingerprint` per slot

## Verification

```bash
npm run typecheck
npm test
npm run build
npm test -- k96cSnapshot
```

## Out of scope

Note schema, KnowledgeIndexService, graph, discovery, sync protocol, export format changes.

## After K-96 series

Resume unfinished K-95 index memory optimization once K-96D is complete.
