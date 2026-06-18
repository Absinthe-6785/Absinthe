# K-94 — Timeline Graph Build Deduplication & Edge Count Pipeline

**Branch:** `k94-timeline-graph-dedupe`  
**Status:** Review package (not merged)

## Problem

`buildKnowledgeTimeline()` previously invoked `buildGlobalGraphData()` once per timeline bucket via `countLinksForNotes()`, plus one extra build for the recent-evolution past snapshot. Discover vault phase resolution built a full graph solely to read `.edges.length`.

For month mode over ~3 years of history:

```
37 snapshot buckets
+ 1 evolution past snapshot
≈ 38 full graph builds per timeline refresh
+ 1 discover vault phase build
```

Each build materializes an edge map, edge array, node array, and sorted node list — large transient allocations and GC pressure (K-93 hotspot).

## Solution

### P1 — Audit harness

- `frontend/src/components/views/k94TimelineGraphAudit.ts`
- `frontend/src/components/views/k94TimelineGraphAudit.test.ts`

Models legacy `(B + 1)` graph builds, measures bucket counts at 100 / 300 / 1000 notes, and spies runtime calls to confirm dedupe hooks.

### P2 — Shared edges per timeline refresh

- Extract `collectGlobalGraphEdges()` from `buildGlobalGraphData.ts`
- `buildKnowledgeTimeline()` collects edges **once** and passes `graphEdges` into `buildSnapshots()` / `buildRecentEvolution()` / `buildSnapshotMetrics()` / `countLinksForNotes()`

### P3 — Discover edge-count path

- Add `KnowledgeIndexService.getGlobalEdgeCount()` (uses `collectGlobalGraphEdges`, no node array)
- `countVaultLinks()` → `service.getGlobalEdgeCount()`
- `buildCosmosEvolutionSummary()` → `service.getGlobalEdgeCount()` for `currentLinks`

## Files

| Action | Path |
|--------|------|
| Created | `frontend/src/components/views/k94TimelineGraphAudit.ts` |
| Created | `frontend/src/components/views/k94TimelineGraphAudit.test.ts` |
| Created | `frontend/docs/K-94-timeline-graph-dedupe.md` |
| Modified | `frontend/src/components/views/features/knowledge/graph/buildGlobalGraphData.ts` |
| Modified | `frontend/src/components/views/features/knowledge/graph/index.ts` |
| Modified | `frontend/src/components/views/features/knowledge/KnowledgeIndexService.ts` |
| Modified | `frontend/src/components/views/features/knowledge/timeline/timelineMetrics.ts` |
| Modified | `frontend/src/components/views/features/knowledge/timeline/knowledgeTimeline.ts` |
| Modified | `frontend/src/components/views/features/knowledge/cosmos/onboarding/cosmosVaultState.ts` |
| Modified | `frontend/src/components/views/features/knowledge/history/historyEvolutionQueries.ts` |

## Before vs after graph-build counts

Fixture: `buildLargeVaultDataset()` with notes spread across 3 years (`K94_AUDIT_NOW = 2026-06-13`).

| Notes | Mode | Buckets (B) | Legacy timeline builds (B+1) | Current timeline edge collections |
|------:|------|------------:|-------------------------------:|----------------------------------:|
| 100 | month | 37 | 38 | 1 |
| 100 | quarter | 13 | 14 | 1 |
| 100 | all | 1 | 2 | 1 |
| 300 | month | 37 | 38 | 1 |
| 300 | quarter | 13 | 14 | 1 |
| 300 | all | 1 | 2 | 1 |
| 1000 | month | 37 | 38 | 1 |
| 1000 | quarter | 13 | 14 | 1 |
| 1000 | all | 1 | 2 | 1 |

Discover refresh (per `resolveCosmosVaultPhase`):

| Path | Legacy | Current |
|------|-------:|--------:|
| Full `buildGlobalGraphData()` | 1 | 0 |
| Edge collection (`getGlobalEdgeCount`) | 0 | 1 |

Evolution summary (`buildCosmosEvolutionSummary`) no longer calls `buildGlobalGraphData()`; uses `getGlobalEdgeCount()` instead.

## Allocation estimates

Model (audit helper `estimateK94Allocation`):

- ~120 B per edge object + ~96 B per node object per full graph build
- Shared path: one edge collection only (~120 B × E)

Example at 300 notes, month mode (~25 global edges in fixture, B=37):

| Metric | Before | After |
|--------|-------:|------:|
| Timeline graph materializations | 38 | 1 |
| Transient edge arrays (timeline) | 38 | 1 |
| Estimated transient bytes (timeline) | ~38 × (E×120 + N×96) | ~1 × (E×120) |
| Reduction | — | **>97%** |

At 1000 notes the relative reduction stays **>97%** because bucket count dominates; absolute savings scale with N and E.

## Risk assessment

| Area | Risk | Mitigation |
|------|------|------------|
| Timeline link counts | Shared edges filtered per bucket by `activeIds` — same logic as before | Equivalence tests per bucket; snapshot regression test |
| Discover vault phase | `getGlobalEdgeCount()` uses same edge dedupe as graph builder | Matches `buildGlobalGraphData().edges.length` in tests |
| Stale edge counts | Index rebuilt before timeline/discover refresh (unchanged contract) | No cache layer added |
| Bucket filtering | `notesActiveAt` unchanged; only edge source shared | Bucket semantics untouched |
| History events | `mergeGrowthWithHistory` / event paths unchanged | No edits to history merge |
| Evolution summary | `currentLinks` via index count vs filtered active set | Equivalent when index matches active notes |

## Out of scope (unchanged)

Cosmos simulation, render throttle, display position cache, graph topology signatures, local reheat, dashboard gating, note editor, memory policy.

## Verification

Run locally:

```bash
cd frontend
npm run typecheck
npm test
npm test -- k94TimelineGraph
npm run build
```

Results recorded in the review package after CI-local run.
