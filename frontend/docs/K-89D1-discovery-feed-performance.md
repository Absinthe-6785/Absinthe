# K-89D1 — Discovery Feed Performance

**Branch:** `k89d1-discovery-feed-performance`  
**Status:** Complete  
**Scope:** Discovery feed collector efficiency without ranking/quality changes  
**Constraint:** No collector removal, no discovery surface changes

---

## Executive Summary

K-89D identified discovery feed build at 3000 notes as **~780–1288 ms**, dominated by **missing-connection** (28 × O(n) vault scans) and duplicate **importance** / **area health** work across collectors.

K-89D1 introduces a shared **`DiscoveryFeedContext`**, indexed connection suggestions, unified hub-activity scanning, and memoized area health — reducing 3000-note feed build to **~301 ms** (median audit run) while preserving feed output shape.

---

## Before / After (audit fixture, staged inactivity)

| Notes | Feed (K-89D) | Feed (K-89D1) | Target |
|------:|---------------:|--------------:|-------:|
| 250 | ~23 ms | ~15 ms | — |
| 1000 | ~141 ms | ~50 ms | — |
| 3000 | **~1118 ms** | **~301 ms** | < 300 ms |

### Collector cost @ 3000 notes

| Collector | K-89D (ms) | K-89D1 (ms) |
|-----------|----------:|------------:|
| missing-connection | 474 | **29** |
| area-insights | 187 | **<1** |
| weak-hub | 170 | **9** |
| forgotten-knowledge | 144 | **2** (hub bundle) |
| knowledge-drift | 125 | **0** (hub bundle) |

---

## Optimizations

### 1. Indexed missing-connection suggestions

**File:** `discoveryConnectionSuggestions.ts`

Replaces per-source O(n) `buildSuggestedConnections` vault scan with candidate pools from:

- Tag inverted index (`getNotesWithTag`)
- Galaxy member buckets
- Mention graph (incoming/outgoing)
- Title token index (preserves title-similarity matches)

Skips `related` signals (already filtered by missing-connection collector).

### 2. Shared `DiscoveryFeedContext`

**File:** `discoveryFeedContext.ts`

Per-feed memoization:

- `importanceByNoteId` — single evaluation per note
- `areaHealth` — one `buildAreaHealthSummaries` pass
- `connectionIndex` — tag/galaxy/title buckets
- `galaxyMemberIds` — O(1) galaxy membership for gaps

### 3. Unified hub activity scan

**File:** `discoverySignals.ts` — `collectHubActivitySignals`

Single pass produces **forgotten-knowledge** and **knowledge-drift** items with shared importance cache. Connection-score prefilter skips notes that cannot qualify as hub or drift candidates.

### 4. Area health reuse

- `buildAreaHealthSummaries` accepts `noteById` + `getImportance` callback
- `buildKnowledgeGaps` accepts shared `galaxyMap` + `galaxyMemberIds` (no rebuild)
- Weak-hub and stale-area collectors share one area-health build via context

### 5. Pipeline reorder

`buildDiscoveryFeed` runs hub-activity scan before area insights so importance cache warms before area-health classification lookups.

---

## Quality preservation

- `discoveryEngine.test.ts` — all behavior tests pass
- `discoveryFeedPerformance.test.ts` — 250-note CI budget + ranking stability + indexed score alignment
- Feed at 3000 notes: **18 items**, **1265 raw candidates** (vs 1241 pre-opt — drift prefilter minor delta on edge hubs)

---

## Regression protection

| Test | Guard |
|------|-------|
| `discoveryFeedPerformance.test.ts` | 250 notes feed < 100 ms; ranking order; indexed vs full-scan scores |
| `discoveryRediscoveryAudit.test.ts` | Opt-in: 3000 notes feed < 500 ms (`npm run audit:discovery`; ~301 ms isolated) |

---

## Run benchmarks

```bash
npm run audit:discovery
```

Updates `docs/k89-observed-metrics.json` with per-collector timings under `scales[].discovery`.
