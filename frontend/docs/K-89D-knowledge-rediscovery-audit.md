# K-89D — Knowledge Rediscovery Audit

**Branch:** `k89d-knowledge-rediscovery-audit`  
**Status:** Audit complete — no optimizations applied  
**Scope:** Discovery feed pipeline, collector cost/quality/redundancy, large-vault scaling  
**Constraint:** Understanding only — no collector removal, no ranking changes

---

## Executive Summary

After K-89C fixed cold index rebuild, **discovery feed generation** is the remaining large-vault bottleneck (~0.8–2.2 s at 3000 notes depending on fixture clock). The dominant cost is **`collectMissingConnectionSignals`** (~45% of collector time at 3000 notes), driven by **`buildSuggestedConnections`** scanning all notes per important source. The second major cost cluster is **area intelligence** (`collectAreaInsightSignals` + `collectWeakHubSignals`), which both call **`buildAreaHealthSummaries`** and related gap analysis.

Quality findings:

- **Forgotten Knowledge** and **Knowledge Drift** overlap ~57% on note IDs — partially deduped in `refineDiscoveryItems`, but both still run full vault scans.
- **Knowledge Drift** produces **1,220 raw candidates** at 3000 notes (unbounded O(n) scan) vs Forgotten’s capped 30-hub scan.
- **Emerging Topic** and **Recently Active Area** collectors exist but are **not wired** into the live feed.
- **Related Notes** (Most Related / Worth Revisiting) is a **separate per-note path** — fast (<1 ms), different signals from vault feed.

---

## A. Rediscovery Audit Report

### Pipeline architecture

```
KnowledgeIndexService (precomputed links, tags, relations, related neighbors)
        ↓
getNoteGalaxyMap (memoized by vaultStructureVersion)
        ↓
┌───────────────────────────────────────────────────────────────┐
│ Collectors (discoverySignals.ts)                              │
│  • collectIsolatedNotesSignals                                │
│  • collectAreaInsightSignals → stale-area only in feed        │
│  • collectForgottenKnowledgeSignals                           │
│  • collectMissingConnectionSignals                            │
│  • collectWeakHubSignals                                      │
│  • collectKnowledgeDriftSignals                               │
│  [NOT WIRED: collectEmergingTopicSignals]                     │
└───────────────────────────────────────────────────────────────┘
        ↓
applyHistoryToDiscoveryItems (historyDiscoveryBoost.ts)
        ↓
refineDiscoveryItems (quality gate, dedupe, confidence filter)
        ↓
Partition by kind → per-section top N + global top 18
        ↓
DiscoveryFeed → DiscoveryPanel / Dashboard / Search badges / Timeline
```

### Parallel rediscovery surfaces (not in feed pipeline)

| Surface | Entry | Trigger | Signals |
|---------|-------|---------|---------|
| **Most Related** | `groupRelatedNotes` → Links tab | `linksTabActive` | Precomputed related score |
| **Worth Revisiting** | `groupRelatedNotes` → Links tab | Same | Incoming links + recency + related score |
| **Knowledge Review** | `buildKnowledgeReviewLists` | Dashboard workspace | recentlyEdited, mostLinked, leastRevisited |
| **Stale buckets** | `buildKnowledgeReview` / `staleNotes` | Dashboard | 30/60/90-day `updatedAt` |
| **Cosmos intelligence** | `buildNoteIntelligenceSnapshot` | Cosmos HUD / panels | Opportunities, gaps, suggestions |
| **Timeline discoveries** | `buildDiscoveryHistory` | Timeline tab | Estimated resolved metrics |

### Collector inventory

| Collector | Feed kind | Wired? | Scan scope | Output cap | Key dependencies |
|-----------|-----------|--------|------------|------------|------------------|
| `collectIsolatedNotesSignals` | `isolated-notes` | Yes | O(n) isolation check | 8 notes | `collectIsolatedNoteIds` |
| `collectAreaInsightSignals` | `stale-area` (+ `recently-active-area` discarded) | Partial | O(n) area health | 3 stale + 3 active | `buildAreaHealthSummaries` |
| `collectForgottenKnowledgeSignals` | `forgotten-knowledge` | Yes | Top 30 hubs by importance | Unbounded post-filter | `evaluateKnowledgeImportance`, `noteLastOpenedAt` |
| `collectMissingConnectionSignals` | `missing-connection` | Yes | 28 sources × O(n) suggestions | 24 pairs | `buildSuggestedConnections`, `hasExistingLink` |
| `collectWeakHubSignals` | `weak-hub` | Yes | 12 knowledge gaps | 12 areas | `buildKnowledgeGaps`, `buildAreaHealthSummaries` |
| `collectKnowledgeDriftSignals` | `knowledge-drift` | Yes | **All active notes** | Unbounded post-filter | Same importance stack as forgotten |
| `collectEmergingTopicSignals` | `emerging-topic` | **No** | 60 recent notes | Cluster min 5 | `buildNoteGalaxyMap`, tags |

### Scoring & ranking

- Per-kind score functions in `discoveryScoring.ts` (importance × inactivity, connection similarity × relevance, etc.).
- Global `MIN_FEED_SCORE = 45` quality gate; missing-connection requires ≥2 signals unless score ≥ 55.
- Confidence tiers: high ≥85, medium ≥50, **low filtered out**.
- `refineDiscoveryItems` dedupes forgotten/drift per note (keeps highest score), missing-connection pairs, and suppresses emerging when weak-hub exists on same area (emerging not in feed today).

### Repeated computation hotspots

| Work unit | Called by | Notes |
|-----------|-----------|-------|
| `buildAreaHealthSummaries` | area-insights, weak-hub, knowledgeGaps | Recomputed per collector; O(n²) inner lookups in health builder |
| `buildNoteGalaxyMap` / `getNoteGalaxyMap` | Feed entry + weak-hub path | Memoized once per feed via `galaxyCacheKey` |
| `evaluateKnowledgeImportance` | Forgotten, drift, missing-connection sources | Per-note; drift runs on **all** hubs/areas |
| `buildSuggestedConnections` | Missing-connection | **O(n) per source note** — full vault scan |
| `hasExistingLink` | Missing-connection filter | `notes.find` × 2 per candidate |

---

## B. Discovery Quality Report

### Useful signals (Core / Useful)

| Signal | Classification | Unique value | Quality notes |
|--------|----------------|--------------|---------------|
| **Missing Connections** | **Core** | Actionable link suggestions between important notes | Highest compute cost; strong when multi-signal pairs pass gate |
| **Forgotten Knowledge** | **Core** | Surfaces neglected **core/major hubs** by last-opened | Capped 30-hub scan; clear user action (revisit) |
| **Isolated Notes** | **Useful** | Structural hygiene — notes with no links/mentions/tags | Fixed score 72; distinct from importance model |
| **Weak Hub** | **Useful** | Area-level gap — cluster without anchor note | Complements per-note signals |
| **Stale Area** | **Useful** | Area health fragmentation/critical orphan ratio | Only stale half wired; active areas discarded |
| **Most Related** | **Core** | Per-note contextual neighbors | Fast index lookup; primary Links tab value |
| **Worth Revisiting** | **Core** | Per-note rediscovery by inlinks + age | Distinct from forgotten (vault-wide hub inactivity) |

### Weak / redundant signals

| Signal | Classification | Issue |
|--------|----------------|-------|
| **Knowledge Drift** | **Redundant (partial)** | ~57% note overlap with Forgotten; scans **all** important notes vs Forgotten’s top-30; uses `updatedAt` vs `lastOpenedAt` — similar intent, different metric |
| **Emerging Topic** | **Low value (unwired)** | Collector implemented but never merged into feed |
| **Recently Active Area** | **Low value (discarded)** | Computed then filtered out before merge |
| **Dashboard leastRevisited** | **Redundant (partial)** | Overlaps forgotten/drift/stale review semantics with simpler `updatedAt` sort |
| **Cosmos suggested connections** | **Redundant (partial)** | Same `buildSuggestedConnections` as missing-connection collector |

### Duplicate signal analysis

Measured on audit fixture with staged inactivity (`now = 2026-06-16`, notes aged 1–150 days):

| Pair | Shared note IDs @ 3000 | Overlap % |
|------|---------------------:|----------:|
| Forgotten ↔ Drift | 12 | **57.1%** |
| Forgotten ↔ Missing-connection | 0 | 0% |
| Drift ↔ Missing-connection | 0 | 0% |
| Isolated ↔ Forgotten | 0 | 0% |
| Stale-area ↔ Weak-hub | 0 | 0% |

`refineDiscoveryItems` keeps at most one of forgotten/drift per note in the final feed, but **both collectors still run full scans** and generate 1,241 raw candidates before refine at 3000 notes.

### Ranking quality

- Feed items sort deterministically by score → title; sections capped at `perSectionLimit` (4 in benchmark, 3 default).
- All 18 final items pass medium/high confidence after refine on audit fixture.
- Missing-connection produced **0 raw items** on the large-vault fixture (existing links / score gates) while still consuming **~358 ms** at 3000 notes — **compute without output** on this dataset.

---

## C. Scaling Report

**Harness:** `discoveryCollectorBenchmark.ts` + `discoveryRediscoveryAudit.test.ts`  
**Metrics:** `docs/k89-observed-metrics.json` (collector-level breakdown under `scales[].discovery`)  
**Run:** `npm run audit:discovery` (opt-in; skipped in CI and default `npm test`)

### Total discovery feed cost

| Notes | discoverMs (live fixture) | totalFeedMs (audit clock) | feedItems | rawCandidates | actionable |
|------:|--------------------------:|--------------------------:|----------:|--------------:|-----------:|
| 250 | 15 | 18 | 18 | 93 | 18 |
| 500 | 37 | 41 | 18 | 204 | 18 |
| 1000 | 108 | 120 | 18 | 398 | 18 |
| 3000 | 780 | 789 | 18 | 1,241 | 18 |

*`discoverMs` uses current-date fixture; `totalFeedMs` uses staged inactivity for quality/candidate volume.*

### Per-collector cost @ 3000 notes (Top 10)

| Rank | Collector | ms | Raw candidates | Wired |
|-----:|-----------|---:|---------------:|:-----:|
| 1 | **missing-connection** | 358 | 0* | Yes |
| 2 | **area-insights (all)** | 133 | 3 | Partial |
| 3 | **weak-hub** | 133 | 0 | Yes |
| 4 | **knowledge-drift** | 111 | 1,220 | Yes |
| 5 | **forgotten-knowledge** | 106 | 21 | Yes |
| 6 | isolated-notes | 2 | 0 | Yes |
| 7 | emerging-topic (unwired) | 2 | 3 | No |
| 8 | galaxyMap | <1 | 3,000 map entries | Yes |
| 9 | historyBoost | <1 | 1,241 | Yes |
| 10 | groupRelatedNotes | <1 | — | Separate UI |

\*Missing-connection runs 28 × O(n) `buildSuggestedConnections` passes; fixture produces no pairs passing `MIN_CONNECTION_SCORE` / link-exists filters.

### Scaling shape

| Collector | 250 ms | 1000 ms | 3000 ms | Scaling |
|-----------|-------:|--------:|--------:|---------|
| missing-connection | 14 | 64 | 358 | ~O(n) per fixed source count |
| knowledge-drift | 1 | 11 | 111 | ~O(n) linear |
| forgotten-knowledge | 1 | 11 | 106 | ~O(n log n) sort + O(30) eval |
| area-insights + weak-hub | 6 | 31 | 266 | ~O(n) with health O(n²) inner |

### Memory / allocation pressure

| Artifact | @ 3000 notes | Notes |
|----------|-------------|-------|
| Galaxy map | 3,000 entries | One per feed build |
| Drift raw items | 1,220 `DiscoveryItem` objects | Discarded heavily in refine |
| History-boosted concat | 1,241 items | Full array before refine |
| Feed output | 18 items + 6 sections × 4 | Bounded |

### Related notes (separate path)

`groupRelatedNotes` remains **<1 ms** at all scales — not a scaling concern.

---

## D. Proposed Follow-Up Branches

### K-89D1 — Discovery Feed Performance

**Goal:** Cut 3000-note feed build from ~0.8–2.2 s to <500 ms without quality regression.

**Candidates (audit-informed, not implemented):**

- Memoize `buildAreaHealthSummaries` once per feed (shared by area-insights + weak-hub).
- Cap `collectKnowledgeDriftSignals` with hub scan limit (mirror forgotten’s top-30).
- Short-circuit `buildSuggestedConnections` with tag/area inverted indexes before full O(n) scan.
- Share importance evaluation cache across collectors for same `(noteId, vaultStructureVersion)`.

### K-89D2 — Rediscovery Ranking Improvements

**Goal:** Sharpen signal distinction without removing collectors.

**Candidates:**

- Unify forgotten/drift into single inactivity collector with dual metrics (`lastOpenedAt` + `updatedAt`) and one scan.
- Wire or remove `collectEmergingTopicSignals` — currently dead code path.
- Surface `recently-active-area` or drop its computation.
- Align dashboard `leastRevisited` with discovery semantics or cross-link.

### K-89D3 — Discovery Surface Consolidation

**Goal:** Reduce user confusion from parallel rediscovery entry points.

**Candidates:**

- Document canonical surfaces: Discover tab (vault feed) vs Links tab (per-note related) vs Dashboard review lists.
- Pass pre-built `discoveryFeed` everywhere (fix `WorkspaceSearchPalette` double-build).
- Defer feed build until Discover tab opens (partially gated today).
- Evaluate Cosmos intelligence vs discovery feed overlap for merge/memoization.

---

## Rediscovery Value Classification

| Surface | Value | Rationale |
|---------|-------|-----------|
| Missing Connections | **Core** | Unique actionable linking — highest product value per audit |
| Forgotten Knowledge | **Core** | Knowledge-first “return to important work” signal |
| Most Related | **Core** | Primary contextual navigation in Links tab |
| Worth Revisiting | **Core** | Per-note rediscovery distinct from vault-wide scan |
| Isolated Notes | **Useful** | Vault hygiene; cheap O(n) |
| Weak Hub / Stale Area | **Useful** | Area-level structural insight |
| Knowledge Drift | **Redundant** | Overlaps forgotten; unbounded scan cost |
| Emerging Topic | **Low value** | Unwired; compute wasted if called |
| Recently Active Area | **Low value** | Computed, discarded |
| Dashboard leastRevisited | **Redundant** | Simpler duplicate of inactivity signals |
| Cosmos duplicate suggestions | **Redundant** | Same engine as missing-connection |

---

## Files Added (audit harness)

| File | Purpose |
|------|---------|
| `src/dev/discoveryCollectorBenchmark.ts` | Per-collector timing, overlap, candidate counts |
| `src/lib/discoveryRediscoveryAudit.test.ts` | Audit test + metrics JSON writer |
| `docs/k89-observed-metrics.json` | Collector-level scaling metrics |
| `docs/K-89D-knowledge-rediscovery-audit.md` | This report |

**No production discovery logic changed.**
