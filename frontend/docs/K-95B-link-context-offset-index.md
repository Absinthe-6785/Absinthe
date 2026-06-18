# K-95B — Link Context Paragraph Offset Index

**Branch:** `k95b-link-context-offset-index`  
**Status:** Review package

## Problem

Links tab open triggered `extractLinkContexts()`, which split every matching note body on `\n\n`, materializing paragraph strings for the full vault scan path.

## Solution

### P1 — Audit

- `frontend/src/components/views/k95bLinkContextAudit.ts`
- `frontend/src/components/views/k95bLinkContextAudit.test.ts`

### P2 — Paragraph offset index

- `frontend/src/components/views/features/knowledge/linkContext/linkContextOffsetIndex.ts`
- `frontend/src/components/views/features/knowledge/linkContext/linkContextOffsetIndex.test.ts`

Stores `{ start, end }` byte ranges per note — **no paragraph text retained**.

### P3 — Excerpt extraction rewrite

`extractLinkContexts` (re-exported from `noteUtils`) uses:

1. Cached paragraph offsets per `noteId` + body fingerprint
2. `body.slice(start, end)` for matching paragraphs only
3. Line-offset fallback identical to legacy path

`NoteView` passes `contentVersion: indexContentVersion` for cache generation sync.

### P4 — Benchmark

Fixture: `buildLargeVaultDataset()` — target note with one backlink in vault.

| Notes | Ref-check bytes | Legacy paragraph split bytes | Offset excerpt slice bytes | Legacy scan ms | Offset scan ms |
|------:|----------------:|-----------------------------:|---------------------------:|---------------:|---------------:|
| 100 | 9,885 | 110 | 34 | 0.67 | 0.52 |
| 300 | 30,045 | 110 | 34 | 0.82 | 0.56 |
| 1000 | 100,736 | 110 | 34 | 3.21 | 1.69 |

**Paragraph split allocations:** eliminated on matching notes (0 vs 1 split per match).  
**Excerpt materialization:** ~69% fewer bytes touched on matching paragraphs.  
**Links tab scan time:** ~22–47% faster (fixture; scales with matching-note count).

Reference-check pass (finding which notes link to target) still scans all active bodies — unchanged without KnowledgeIndexService backlink index.

## Files

| Action | Path |
|--------|------|
| Created | `frontend/src/components/views/k95bLinkContextAudit.ts` |
| Created | `frontend/src/components/views/k95bLinkContextAudit.test.ts` |
| Created | `frontend/docs/K-95B-link-context-offset-index.md` |
| Created | `frontend/src/components/views/features/knowledge/linkContext/linkContextOffsetIndex.ts` |
| Created | `frontend/src/components/views/features/knowledge/linkContext/linkContextOffsetIndex.test.ts` |
| Modified | `frontend/src/components/views/noteUtils.ts` |
| Modified | `frontend/src/components/views/NoteView.tsx` |

## D. Invalidation strategy

| Event | Behavior |
|-------|----------|
| Body edit | `bodyFingerprint(body)` mismatch → rebuild offsets for that `noteId` only |
| `indexContentVersion` bump | `syncLinkContextOffsetCache(contentVersion)` clears module cache |
| Explicit | `invalidateLinkContextOffsetNote(noteId)` / `clearLinkContextOffsetIndex()` |

No persistent excerpt cache. Offsets only.

## E. Risk assessment

| Area | Risk | Mitigation |
|------|------|------------|
| Excerpt text drift | Offset boundaries differ from split | Unit tests match `split(/\n{2,}/)`; legacy parity @ 100/300/1000 |
| Highlight behavior | Excerpt strings unchanged | JSON equivalence tests |
| Stale offsets | Body edit without version bump | Body fingerprint invalidates per note |
| Memory | Offset map growth | Numeric ranges only; cleared on content version |

## F. Verification results

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm test -- k95bLinkContext` | **13 passed** |
| `npm test -- linkContextOffsetIndex` | **7 passed** |
| `npm test` | **2301 passed**, 7 skipped |
| `npm run build` | Pass |

## Out of scope

KnowledgeIndexService, DiscoveryFeed, Cosmos, dashboard scope, graph, search ranking, UI layout.
