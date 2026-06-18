# K-97G — Server Memory Mitigation

Reduces Render 512 MB OOM risk identified by K-97F.

**Branch:** `k97g-server-memory-mitigation`  
**Status:** Review package — not merged

## Workstreams

| ID | Change | Backward compatible |
|----|--------|---------------------|
| A | `GET /api/notes?updated_after=` incremental sync | Yes — param absent → full vault |
| B | Sequential JSON backup + `GET /api/backup/stream` ZIP | Yes — `/api/backup` JSON schema unchanged |
| C | `POST /api/notes/batch` with chunk size 1–100 | Yes — single `POST /api/notes` preserved |
| D | Memory watchdog middleware (warn only) | Yes — no process exit |

## Backend modules

| File | Role |
|------|------|
| `backend/notes_sync.py` | Incremental filter + batch chunking |
| `backend/backup_stream.py` | Sequential fetch + streaming ZIP |
| `backend/memory_watchdog.py` | RSS/heap sampling + warnings |
| `backend/main.py` | Wired endpoints + middleware |

## Audit harness

| File | Matrix |
|------|--------|
| `k97gIncrementalSyncAudit.ts` | Payload + heap @ 100/300/1000/3000 |
| `k97gBackupStreamAudit.ts` | Peak heap buffered vs stream |
| `k97gBatchSyncAudit.ts` | Request counts chunk 20/50/100 |
| `k97gMemoryWatchdog.ts` | Thresholds + warning format |

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm test -- k97g
```

## Review tables

Run `npm test -- k97g` to print:

### Incremental Sync

Full vs incremental payload bytes and estimated heap reduction %.

### Backup Stream

Buffered parallel peak vs sequential/streaming peak heap.

### Batch Sync

Single POST count vs batch request count per chunk size.

### Memory Watchdog

- heapUsed warn: **350 MB**
- rss warn: **450 MB**
- sample interval: **1 s**
- format: `[memory-watchdog] high memory context=... rss=... heapUsed=...`

## Compatibility (Workstream E)

- Export/import schemas unchanged for `GET /api/backup` JSON
- Cloud sync clients can adopt `updated_after` optionally
- No note schema migrations
- No required frontend changes

## Out of scope

- Client adoption of batch/incremental endpoints (optional follow-up)
- Render autoscaling / instance size changes
