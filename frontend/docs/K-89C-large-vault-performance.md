# K-89C — Large Vault Performance

**Branch:** `k89c-large-vault-performance`  
**Status:** Complete  
**Scope:** Cold index rebuild scalability, related-candidate pipeline, incremental updates, discovery feed audit  
**Constraint:** No user-visible behavior changes — algorithmic and indexing efficiency only

---

## Executive Summary

K-89 identified **O(n²) related-candidate precomputation** during `KnowledgeIndexService.buildFromNotes()` as the primary cold-start bottleneck. K-89C restructures the related-notes pipeline so tag-only pairs are merged lazily at query time, defers bulk tag bookkeeping, and adds a title substring prefilter for mention indexing.

**Targets met:**

| Notes | K-89 (before) | K-89C (after) | Target |
|------:|--------------:|--------------:|-------:|
| 1000 | 2,818 ms | **70 ms** | < 1,000 ms |
| 3000 | 28,278 ms | **993 ms** | < 5,000 ms |

Search, sidebar, Cosmos graph, and per-note related-notes queries remain fast. Discovery feed at 3000 notes (~2.2 s) is documented as follow-up debt — not part of the index rebuild target.

---

## 1. Related Notes Pipeline Audit

### Pipeline trace

```
normalizeNote (store)
  ↓
KnowledgeIndexService.buildFromNotes / updateNote
  ↓
  ├─ edges, properties, relations (O(n))
  ├─ tags → notesByTag buckets (O(n × tags))
  ├─ titleSearchIndex + indexMentionsFromSource (O(n × titles), prefiltered)
  ├─ rebuildStructuralRelatedForNote per note (O(n × neighbors))
  ├─ rebuildAllTagMemberSorts (O(tags × members log members))
  └─ rebuildUniqueRelatedCounts (O(n × tags))
  ↓
getRelatedNotes(noteId)
  ├─ relatedByNoteId (structural cache)
  └─ getTopSharedTagRelated (lazy tag merge, k-way merge by title)
  ↓
groupRelatedNotes → Most Related / Worth Revisiting (discovery UI)
```

### Before K-89C — complexity

| Stage | Complexity | Issue |
|-------|------------|-------|
| `rebuildRelatedForNote` (old) | **O(n²)** | Every note × every tag-bucket member → pairwise `computeRelatedScore` |
| `indexMentionsFromSource` (old) | **O(n²)** | Every note body scanned against every title with full word-boundary check |
| `relatedByNoteId` storage | O(n × avg related) | Stored tag-only pairs alongside structural pairs — duplicate work |
| `getRelatedNotes` | O(1) lookup | Fast, but paid for at build time |

### After K-89C — complexity

| Stage | Complexity | Change |
|-------|------------|--------|
| `rebuildStructuralRelatedForNote` | O(n × structural neighbors) | Tag-only pairs excluded from cold precompute |
| `getTopSharedTagRelated` | O(limit × tags × log bucket) | Lazy k-way merge from sorted `tagMembersByTitle` |
| `indexMentionsFromSource` | O(n × titles) with `includes` prefilter | Cheap substring gate before `containsWholeWordMention` |
| `uniqueRelatedCount` | O(n × tags) | Replaces storing full tag-only candidate lists |

### Hot paths (cold build)

1. **Mention indexing** — still O(n × titles) but prefilter cuts regex/word-boundary work sharply.
2. **Structural related rebuild** — O(n × degree); sparse vaults stay linear-ish.
3. **Tag member sorts** — one pass per tag at end of build (`deferTagRelatedRefresh`).
4. **Unique related counts** — O(n × tags per note); cheap vs former pairwise scoring.

### Repeated work removed

- Tag-only pairs no longer scored and stored in `relatedByNoteId` during cold build.
- Per-tag sort refresh during bulk tag upsert suppressed via `deferTagRelatedRefresh`.
- `getConnectionScore` uses `uniqueRelatedCount` instead of `relatedByNoteId.length` (which under-counted tag neighbors before, over-stored them during build).

### Allocation pressure

- **Before:** Large `RelatedNote[]` per note including hundreds of tag-only entries on shared tags (e.g. `#reference`).
- **After:** Structural arrays only; tag fill allocated on demand in `getTopSharedTagRelated` (bounded by `limit`).
- **Mentions:** `titleSearchIndex` reused across all source notes — one array vs repeated title iteration.

---

## 2. O(n²) Removal

### Pairwise comparisons eliminated

**Old `rebuildRelatedForNote`:** For each note, iterate all co-tag members and call `computePairRelatedScore` — effectively every-note vs every-note on popular tags.

**New split:**

- **Structural neighbors** precomputed once: links, mentions, relations, shared-relation targets.
- **Tag-only neighbors** merged at read time via sorted tag buckets (`tagMembersByTitle`).

Ranking preserved: structural entries sort by score first; tag fill uses `RELATED_SCORE.SHARED_TAG` and title order (same tie-break as before).

### Mention indexing

**Old:** `for (entry of titleSearchIndex) { containsWholeWordMention(...) }` on every body.

**New:** `plainLower.includes(entry.titleLower)` gate + `bodyTextWithoutWikiLinks` to avoid wiki-link false positives.

### Candidate pre-filtering

- `collectStructuralNeighbors` limits incremental rebuild scope on `updateNote` / `removeNote`.
- `getRelatedNotes` only merges tag candidates when structural cache is below `limit`.

---

## 3. Incremental Index Validation

### Actual behavior

| Trigger | Path | Scope |
|---------|------|-------|
| Single note create/edit/restore | `updateNote()` | Affected structural neighbors + edited note only |
| Note trash/delete | `removeNote()` | Structural neighbors of removed note |
| Full vault hydrate / import | `buildFromNotes()` | Full cold rebuild |

`updateNote()` does **not** re-scan the full vault. It:

1. Removes old edges, relations, mentions, tags for the note.
2. Re-indexes the note's edges, properties, tags, relations, mentions.
3. Rebuilds structural related + `uniqueRelatedCount` for `collectStructuralNeighbors(noteId)` ∪ `{noteId}`.

Tag-only related results remain lazy — no full tag-bucket sweep on edit.

### Safe incremental updates

Already implemented in K-83A; K-89C preserves and extends this model. No new full-rebuild triggers added.

---

## 4. Discovery Feed Optimization

### K-89 finding

Discovery feed at 3000 notes: **~1,543 ms** (K-89) → **~2,233 ms** (K-89C local run; variance from signal collectors).

### Investigation

`buildDiscoveryFeed` runs vault-wide signal collectors:

- `collectForgottenKnowledgeSignals` — per-note `evaluateKnowledgeImportance` + galaxy assignment
- `collectMissingConnectionSignals` — `buildSuggestedConnections` per hub
- `collectWeakHubSignals`, `collectKnowledgeDriftSignals`, `collectAreaInsightSignals`
- `getNoteGalaxyMap` built once per feed (cached via `galaxyCacheKey` in dashboard)

These paths call `getConnectionScore` and graph intelligence helpers — **O(n)** to **O(n × degree)** per collector, independent of the index rebuild fix.

### Duplicated computations

- Galaxy map: single build per feed (not duplicated across collectors when `galaxyMap` passed).
- `getConnectionScore`: called per note in importance/hub evaluators — uses cheap O(1) index lookups post K-89C.
- Related notes in discovery sections (Most Related / Worth Revisiting) use `groupRelatedNotes` — **<1 ms** at all scales.

### Recommendation (future sprint)

- Memoize `evaluateKnowledgeImportance` per `(noteId, vaultStructureVersion)`.
- Cap `collectMissingConnectionSignals` candidate fan-out on large vaults.
- Defer discovery feed build until Discover tab opens (already partially gated in `useNoteViewDashboard`).

**Not changed in K-89C** — index rebuild was the critical path; discovery quality preserved.

---

## 5. Memory Audit

| Structure | Before | After |
|-----------|--------|-------|
| `relatedByNoteId` | Structural + all tag-only pairs | Structural only |
| `tagMembersByTitle` | N/A | Sorted note ID arrays per tag |
| `uniqueRelatedCount` | N/A | Scalar per note for connection score |
| `titleSearchIndex` | N/A | Cached `{id, title, titleLower}[]` for mentions |

`relatedCandidates` mem-audit metric now reports sum of `uniqueRelatedCount` (neighbor cardinality) rather than stored pair objects — smaller heap, same scoring semantics.

---

## 6. Benchmark Validation

**Harness:** `src/dev/largeVaultBenchmark.ts`  
**Test:** `npm test -- largeVaultUsageAudit knowledgeIndexPerformance`  
**Metrics file:** `docs/k89-observed-metrics.json` (regenerated by `npm run audit:discovery`)

### Before / after (median of 3 samples, local Vitest)

| Notes | Index (K-89) | Index (K-89C) | Search | Discovery | Cosmos |
|------:|-------------:|----------------:|-------:|----------:|-------:|
| 250 | 82 ms | 10 ms | 3 ms | 51 ms | 1 ms |
| 500 | 328 ms | 22 ms | 2 ms | 95 ms | 1 ms |
| 1000 | 2,818 ms | 70 ms | 4 ms | 201 ms | 2 ms |
| 3000 | 28,278 ms | 993 ms | 16 ms | 2,233 ms | 7 ms |

---

## Regression Protection

| Test file | Guards |
|-----------|--------|
| `largeVaultUsageAudit.test.ts` | K-89C index budgets at 1000/3000; fast paths at 250/500 |
| `knowledgeIndexPerformance.test.ts` | Cold build budgets; incremental vs cold; related query latency |
| `relatedNotes.test.ts` | Ranking, incremental update, tag/backlink/mention scoring (behavior) |

---

## Files Changed

- `KnowledgeIndexService.ts` — structural/tag split, lazy tag merge, mention prefilter, deferred bulk tag refresh
- `largeVaultUsageAudit.test.ts` — K-89C index regression budgets
- `knowledgeIndexPerformance.test.ts` — focused performance tests
- `docs/k89-observed-metrics.json` — benchmark snapshot (refresh via `npm run audit:discovery`)
- `docs/K-89C-large-vault-performance.md` — this report
