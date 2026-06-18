# K-97F — Server Memory Audit (Render 512 MB)

Companion to [K-97F-stability-memory-seed.md](./K-97F-stability-memory-seed.md).

## Context

FastAPI backend (`backend/main.py`) on Render with **512 MB** process limit. Primary spikes:

1. `GET /api/notes` — full vault `select("*")` on login hydration
2. `GET /api/backup` — 12 parallel table fetches materialized into one JSON blob
3. Burst `POST /api/notes` during cloud merge of local-only notes

## Harness

```powershell
npm test -- k97fServerMemory
```

## Payload matrix (representative fixture)

`buildLargeVaultDataset()` — ~300 B average body per note. Production vaults with larger bodies scale linearly on the notes column.

Run `formatK97fPayloadReport()` for MB values at 100 / 300 / 1000 / 3000 notes.

## OOM candidates (ranked)

1. **GET /api/backup** — critical @ 3000+ notes with rich bodies
2. **GET /api/notes** — critical on every login hydration
3. **POST /api/notes burst** — high during merge
4. **Client export ZIP** — high duplicate serialization
5. **Snapshot auto-save** — medium periodic spike

## Cache audit summary

Bounded client caches (K-95E/K-96): paragraph offsets (512), galaxy map (1), notesCache (1).

Unbounded server paths: full-vault GET/backup responses — require streaming or incremental sync for large vaults.

## Incremental sync (documented only)

| Pattern | Est. bytes @ 1000 notes |
|---------|------------------------:|
| Full vault GET | ~fixture MB |
| `updated_after` delta (~12 notes) | ~1% of full |

Expected memory savings: **>50%** on steady-state login (see `analyzeK97fIncrementalSync()`).

## Next steps (post-review)

1. Add `updated_after` query param to `GET /api/notes`
2. Stream or chunk `GET /api/backup`
3. Optional Python `tracemalloc` / RSS logging middleware on Render

No production instrumentation in this review package.
