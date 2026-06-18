# K-95A — Discovery Feed Context Sharing

**Branch:** `k95a-discovery-context-sharing`  
**Status:** Review package

## Problem

Cosmos HUD refresh (`NoteGraphView`) previously called `buildDiscoveryFeed()` and `buildCosmosVaultAnalysis()` separately, each building:

- its own `getNoteGalaxyMap()` pass
- its own `DiscoveryFeedContext`
- duplicate importance evaluations and area-health scans

## Solution

### P1 — Audit

- `frontend/src/components/views/k95aDiscoveryFeedAudit.ts`
- `frontend/src/components/views/k95aDiscoveryFeedAudit.test.ts`

### P2 — Shared `DiscoveryFeedContext`

Extended context with per-refresh caches:

| Field | Purpose |
|-------|---------|
| `connectionSignals` | Cached missing-connection items |
| `relationshipSignals` | Cached hub activity (forgotten + drift) |
| `candidatePool` | Shared connection candidate index (alias of `connectionIndex`) |

New API:

- `buildDiscoveryRefreshBundle()` — one context, feed + vault analysis
- `buildCosmosVaultAnalysis(notes, service, ctx?)` — reuses importance + area-health caches
- `ensureSharedConnectionSignals()` / `ensureSharedRelationshipSignals()`

`NoteGraphView` uses `buildDiscoveryRefreshBundle` when building a local HUD feed.

### P3 — Allocation attribution

Fixture: `buildLargeVaultDataset()` @ 100 / 300 / 1000 notes.

| Notes | Legacy galaxy builds | Shared galaxy builds | Legacy contexts | Shared contexts |
|------:|---------------------:|---------------------:|----------------:|----------------:|
| 100 | 2 | 1 | 2 | 1 |
| 300 | 2 | 1 | 2 | 1 |
| 1000 | 2 | 1 | 2 | 1 |

**Reduction:** 50% fewer galaxy-map builds and context allocations per Cosmos HUD refresh.

Output bytes (feed + vault analysis JSON) are unchanged — equivalence tests assert parity.

## Files

| Action | Path |
|--------|------|
| Created | `frontend/src/components/views/k95aDiscoveryFeedAudit.ts` |
| Created | `frontend/src/components/views/k95aDiscoveryFeedAudit.test.ts` |
| Created | `frontend/docs/K-95A-discovery-context-sharing.md` |
| Modified | `frontend/src/components/views/features/knowledge/discovery/discoveryFeedContext.ts` |
| Modified | `frontend/src/components/views/features/knowledge/discovery/discoveryTypes.ts` |
| Modified | `frontend/src/components/views/features/knowledge/discovery/discoverySignals.ts` |
| Modified | `frontend/src/components/views/features/knowledge/discovery/discoveryEngine.ts` |
| Modified | `frontend/src/components/views/features/knowledge/discovery/index.ts` |
| Modified | `frontend/src/components/views/features/knowledge/cosmos/intelligence/cosmosAnalysis.ts` |
| Modified | `frontend/src/components/views/NoteGraphView.tsx` |

## Risk assessment

| Area | Risk | Mitigation |
|------|------|------------|
| Feed ranking | Shared caches could reorder items | JSON equivalence tests @ 100/300/1000 |
| Vault analysis counts | Shared importance cache | Equivalence tests vs standalone path |
| Dashboard scope | Unchanged — `useNoteViewDashboard` still calls `buildDiscoveryFeed` alone | No dashboard edits |
| Shared feed from dashboard | Cosmos HUD still runs standalone vault analysis when feed is shared | Preserves K-89B2B dedupe |

## Verification

```bash
npm run typecheck
npm test
npm test -- k95aDiscoveryFeed
npm run build
```

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm test -- k95aDiscoveryFeed` | **20 passed** |
| `npm test` | **2281 passed**, 7 skipped |
| `npm run build` | Pass |

## Out of scope

KnowledgeIndexService, Links tab, dashboard scope gating, K-92B/K-94 paths, UI/ranking changes.
