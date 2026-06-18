# K-95 — Knowledge Index Memory Footprint Audit

**Branch:** `k95-index-memory-optimization`  
**Status:** Review package (audit only — no production changes)

## Context

K-94 deduplicated timeline graph materialization. K-95 attributes the largest **retained** structures still on the heap after that work:

1. Zustand `notes[]` bodies (dominant in production vaults)
2. `KnowledgeIndexService` singleton maps
3. Full-vault body scans via `extractLinkContexts()` (Links tab)
4. Discovery feed transient + retained allocations
5. Index rebuild amplification on incremental updates

## Audit harness

| File | Role |
|------|------|
| `frontend/src/components/views/k95KnowledgeIndexAudit.ts` | Map counts, byte estimates, growth curve, P2–P4 analysis |
| `frontend/src/components/views/k95KnowledgeIndexAudit.test.ts` | Policy reads, monotonic growth, ranking, equivalence guards |
| `frontend/docs/K-95-knowledge-index-memory.md` | This document |

Run metrics table locally:

```bash
K95_PRINT=1 npm test -- k95KnowledgeIndex -t "prints growth"
```

---

## A. File inventory

| Action | Path |
|--------|------|
| Created | `frontend/src/components/views/k95KnowledgeIndexAudit.ts` |
| Created | `frontend/src/components/views/k95KnowledgeIndexAudit.test.ts` |
| Created | `frontend/docs/K-95-knowledge-index-memory.md` |
| Modified | *(none — audit only)* |
| Deleted | *(none)* |

---

## B. Heap estimates

**Fixture:** `buildLargeVaultDataset()` via `buildK95IndexAuditFixture()` — representative wiki-link mix with ~300 B average body. Production vaults with richer note bodies scale roughly linearly on the `notesBodiesBytes` column (see scaling note below).

Measured retained estimates (MB) from `runK95GrowthCurve()`:

| Notes | Bodies | Index total | relatedByNoteId | Mentions | Tags | Title index | Backlinks |
|------:|-------:|------------:|----------------:|---------:|-----:|------------:|----------:|
| 100 | 0.01 | 0.07 | 0.01 | ~0 | 0.01 | 0.01 | 0.01 |
| 300 | 0.03 | 0.20 | 0.04 | ~0 | 0.02 | 0.03 | 0.03 |
| 1000 | 0.10 | 0.67 | 0.13 | ~0 | 0.08 | 0.10 | 0.10 |
| 3000 | 0.31 | 2.01 | 0.39 | ~0 | 0.25 | 0.31 | 0.31 |

**Production scaling (illustrative):** At ~4 KB average body (typical study vault), multiply `bodiesMB` by ~13×:

| Notes | Est. bodies (production) | Est. index (fixture ratio) |
|------:|-------------------------:|---------------------------:|
| 100 | ~0.13 MB | ~0.07 MB |
| 300 | ~0.39 MB | ~0.20 MB |
| 1000 | ~1.3 MB | ~0.67 MB |
| 3000 | ~4.0 MB | ~2.0 MB |

At 1000+ notes with large bodies (40–120 MB total store cited in K-93), **Zustand bodies remain the dominant retained consumer**; index maps grow to a comparable secondary tier (~15–45 MB modeled in production).

**Index map object counts (1000 notes):**

| Structure | Count |
|-----------|------:|
| `activeNotes` | 1000 |
| `relatedByNoteId` lists | 1000 |
| `relatedByNoteId` entries | ~498 |
| `uniqueRelatedCount` | 1000 |
| `titleSearchIndex` | 1000 |
| Outgoing link strings | ~250 |
| Incoming ref entries | ~250 |

Mem-audit `relatedCandidates` sum at 100 notes: **3548** — reflects tag-touch inflation in `uniqueRelatedCount`, not structural neighbor count alone.

---

## C. Top memory consumers (ranked)

At **1000 notes** (fixture), ranked by estimated retained bytes:

| Rank | Consumer | Est. share |
|-----:|----------|------------|
| 1 | `KnowledgeIndexService` (total maps) | ~55–65% |
| 2 | Zustand note bodies | ~35–45% |
| 3 | `relatedByNoteId` | ~20% of index |
| 4 | Title search index + backlinks | ~15% of index each |
| 5 | Tags / properties | ~10% of index |
| 6 | Discovery feed (retained per refresh) | ~7 KB transient snapshot |
| 7 | `buildCosmosVaultAnalysis` output | ~2–5 KB |

In **production-sized bodies**, order inverts: **note bodies #1**, **index #2**.

**Allocation spikes (not retained):**

| Path | Trigger | Cost |
|------|---------|------|
| `extractLinkContexts` | Links tab open | O(N × body bytes) full vault scan |
| `buildDiscoveryFeed` | Dashboard / Cosmos HUD | Galaxy map + signal arrays + refine pass |
| `buildCosmosVaultAnalysis` | Context panel / HUD | Per-note importance + opportunities |
| `updateNote` | Keystroke (debounced) | Structural neighbor `relatedByNoteId` rebuild fan-out |

---

## D. Optimization opportunities

### P2 — `relatedByNoteId` / `uniqueRelatedCount`

| Finding | Detail |
|---------|--------|
| Neighbor density | ~0.5 structural neighbors/note (fixture); sparse wiki-link graph |
| Duplication | Every `RelatedNote` stores `noteTitle` already in `activeNotes` |
| `uniqueRelatedCount` | Parallel map; derivable from structural length + tag-touch formula |
| Compact estimate | **~35–40%** byte reduction on related storage with tuple/bitmask encoding |

| Option | Retained Δ | Alloc Δ | Complexity | Risk |
|--------|-----------:|--------:|:----------:|:----:|
| Compact arrays (id + score + reason flags) | −35% related | −10% | Medium | Medium |
| Lazy generation on first `getRelatedNotes` | −25% index | −15% rebuild | High | Medium |
| Derive `uniqueRelatedCount` on demand | −2% index | −5% | Low | Low |

**Ranking behavior:** All options must preserve sort order and score thresholds — no ranking changes proposed in this pass.

### P3 — `extractLinkContexts`

| Finding | Detail |
|---------|--------|
| Scan scope | Every active note body on Links tab open (`linksTabActive` gate in `NoteView.tsx`) |
| Scan size | Equals total vault body bytes (e.g. 0.31 MB fixture @ 3000 notes) |
| Frequency | Re-runs on `indexContentVersion` change |
| Result size | Small (only matching notes); **scan cost dominates** |

| Option | Retained Δ | Alloc Δ | Complexity | Risk |
|--------|-----------:|--------:|:----------:|:----:|
| Paragraph offset index in knowledge index | 0 | **−85%** tab-open scan | Medium | Medium |
| Per-target excerpt cache + invalidation | Small cache | **−70%** rescan | High | Medium |

**Note:** `buildConnectionSignals` / `buildRelationshipInsights` from the spec map to `collectMissingConnectionSignals` + `buildDiscoveryConnectionSuggestions` in this codebase.

**No implementation in K-95** — audit only; paragraph index is medium-risk but highest ROI for Links tab.

### P4 — Discovery feed memory

| Finding | Detail |
|---------|--------|
| `buildDiscoveryFeed` | ~7.4 KB JSON snapshot (fixture); 18 items retained |
| Duplicate work | `getNoteGalaxyMap` rebuilt per feed; partial dedupe via `galaxyCacheKey` (K-89B2B palette) |
| `buildCosmosVaultAnalysis` | Separate full-vault pass; overlaps importance evaluation with discovery context |
| Connection signals | `collectMissingConnectionSignals` builds large candidate sets before quality gate |

| Option | Retained Δ | Alloc Δ | Complexity | Risk |
|--------|-----------:|--------:|:----------:|:----:|
| Share `DiscoveryFeedContext` across dashboard/HUD/palette | −5% | **−40%** rebuild | Low | Low |
| Cap raw missing-connection candidates pre-refine | −10% | **−25%** | Medium | Medium |

---

## E. Risk assessment

| Area | Risk | Mitigation |
|------|------|------------|
| Index correctness | Compact/lazy related storage could miss incremental invalidation | Keep rebuild neighbor set identical to `collectStructuralNeighbors` |
| Stale neighbors | Lazy generation needs same invalidation as `updateNote` fan-out | Mirror existing `affected` set logic |
| Incremental rebuild | Tag-wide `refreshUniqueRelatedCountsForTag` amplifies edits | Scope rebuild to structural neighbors first |
| Search correctness | Title index changes affect mention detection | Do not share title index with search without alias tests |
| Relation correctness | Separate incoming/outgoing relation maps | Any dedupe must preserve directed edges |
| Links tab excerpts | Cached offsets must invalidate on body edit | Tie to `indexContentVersion` / note `updatedAt` |
| Discovery ranking | Signal caps could drop valid items | Preserve quality gate ordering in audit tests |

---

## F. Verification results

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm test` | **2261 passed**, 7 skipped (327 files) |
| `npm test -- k95KnowledgeIndex` | **13 passed** |
| `npm run build` | Pass |

---

## Out of scope (unchanged)

K-92B simulation/render pipeline, K-94 timeline dedupe, Cosmos force sim, topology signatures, local reheat, dashboard gating, note editor, UI.

## Recommended next steps (post-review)

1. **P2 low-risk:** Derive `uniqueRelatedCount` on read; drop redundant map (~2% index, low risk).
2. **P2 medium ROI:** Compact `RelatedNote` storage without title duplication (~35% related bytes).
3. **P3 medium ROI:** Incremental link-context index with per-note invalidation (Links tab allocation spike).
4. **P4 low-risk:** Ensure single shared discovery context per dashboard refresh scope.

No production code changes included in this branch — implement after review approval.
