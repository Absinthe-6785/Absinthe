# K-95D — Discovery Candidate Memory Optimization

Reduces retained memory and allocation churn in the discovery pipeline without changing feed quality, ranking, or UI output.

## Changes

| Area | Behavior |
|------|----------|
| **Compact candidates** (`discoveryCompactCandidate.ts`) | Score suggestions as `{ noteId, score, signalFlags }`; hydrate titles at read time |
| **Shared galaxy buckets** (`discoveryFeedContext.ts`) | `getGalaxyMemberIds()` aliases `candidatePool.galaxyMembers` — no duplicate bucket map |
| **Suggestion build** (`discoveryConnectionSuggestions.ts`) | Reuses source title tokens; single ranked pass; compact scored map |
| **Relationship signals** (`discoverySignals.ts`) | Hub rank pool stores note ids + scores instead of full note objects |
| **Refinement** (`discoveryEngine.ts`) | Sort filtered discovery items once per refine pass |

## Memory targets

| Metric | Target |
|--------|--------|
| Candidate pool | 20–40% reduction vs legacy object-shaped estimates |
| Galaxy bucket duplication | 0 bytes (shared reference) |
| Signal allocations | Fewer intermediate note objects in hub ranking |
| Temporary objects | Reduced maps/arrays during suggestion scoring |

## Audit matrix

Run `npm test -- k95dDiscoveryMemory` to print metrics at 100 / 300 / 1000 / 3000 notes:

- candidatePool bytes
- signal bytes
- galaxy bucket bytes
- duplicate galaxy bucket bytes (expect 0)
- retained object count
- candidate reduction %

## Compatibility

Tests verify unchanged output for:

- Discovery feed (`feedsAreEquivalent`)
- Vault analysis / Cosmos HUD (`vaultAnalysisIsEquivalent`)
- `buildDiscoveryRefreshBundle()`
- Missing connection suggestions (stable ranking)
- Connection suggestion title hydration

## Verification

```bash
npm run typecheck
npm test
npm run build
npm test -- k95dDiscoveryMemory
```

## Out of scope

Graph simulation, note schema, KnowledgeIndexService APIs, storage layer, feed ranking changes, K-95E allocator cleanup.

## After K-95D

```text
K-95A ✓ Discovery context sharing
K-95B ✓ Link context offset index
K-95C ✓ Knowledge index memory reduction
K-95D ✓ Discovery memory optimization
↓
K-95E Large vault allocator cleanup and final memory audit
```
