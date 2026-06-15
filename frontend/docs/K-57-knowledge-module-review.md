# K-57 Knowledge Module Review

Branch: `k57-noteview-knowledge-refactor`  
Date: 2026-06-15

## Summary

The knowledge root barrel (`features/knowledge/index.ts`) was a 900+ line re-export monolith. K-57 splits domain exports into focused sub-barrels while preserving the public API via `export *` re-exports at the root.

| Metric | Before (K-56 end) | After (K-57) | Δ |
|--------|-------------------|--------------|---|
| `knowledge/index.ts` lines | ~1,055 | **78** | **−977 (−93%)** |
| Domain barrels created | 0 | **8** | — |
| `typecheck` | PASS | PASS | — |

## Before

```
knowledge/index.ts (~1,055 lines)
├── Core: backlinks, mentions, KnowledgeIndexService, properties, tags
├── Inline UI component exports (~120 lines)
├── Inline maps/academic/analytics/research/study/review blocks
├── Inline query, views, collections, databaseViews, trace, archive…
└── export * from workspace, cosmos, discovery, timeline, history
```

## After

```
knowledge/
├── index.ts (78 lines)           # Core + re-exports only
├── components/index.ts (79)      # Panel & dashboard UI components
├── maps/index.ts (75)            # Concept hub, learning paths, clusters
├── academic/index.ts (63)        # Study projects, milestones, dashboards
├── analytics/index.ts (37)       # Progress, health, activity insights
├── research/index.ts (47)        # Note classification, reading pipeline
├── study/index.ts (24)           # Study notes, weak topics
├── review/index.ts (44)          # Stale/orphan/review queue
├── references/index.ts (7)       # Footnote/reference extraction
├── graph/index.ts                # (existing)
├── history/index.ts              # (existing)
├── workspace/index.ts            # (existing)
├── cosmos/index.ts               # (existing)
├── discovery/index.ts            # (existing)
├── timeline/index.ts             # (existing)
└── … (trace, archive, relations, rollups, formulas, databaseViews, query, views, collections)
```

## Root barrel structure

```ts
// Core exports (lines 1–53 equivalent)
export { … } from './backlinks';
export { … } from './mentions';
export { … } from './KnowledgeIndexService';
export { … } from './properties';
export { … } from './tags';

// Domain re-exports
export * from './components';
export * from './maps';
export * from './academic';
export * from './analytics';
export * from './research';
export * from './study';
export * from './graph';
export * from './related';
export * from './review';
export * from './references';
export * from './query';
export * from './views';
export * from './collections';
export * from './databaseViews';
export * from './trace';
export * from './archive';
export * from './relations';
export * from './rollups';
export * from './formulas';
export * from './workspace';
export * from './cosmos';
export * from './discovery';
export * from './timeline';
export * from './history';
```

## Dependency rules

| Rule | Status |
|------|--------|
| Domain barrels import from subfolders only | ✓ |
| Domain barrels never import from root `index.ts` | ✓ |
| Root imports domain barrels via `export *` | ✓ |
| No new circular dependencies | ✓ (typecheck verified) |

## Files created

| File | Lines |
|------|-------|
| `knowledge/components/index.ts` | 79 |
| `knowledge/maps/index.ts` | 75 |
| `knowledge/academic/index.ts` | 63 |
| `knowledge/analytics/index.ts` | 37 |
| `knowledge/research/index.ts` | 47 |
| `knowledge/study/index.ts` | 24 |
| `knowledge/review/index.ts` | 44 |
| `knowledge/references/index.ts` | 7 |

## Files modified

| File | Change |
|------|--------|
| `knowledge/index.ts` | Slimmed to core + re-exports |
| `knowledge/collections/index.ts` | Added `smartCollectionGroups` re-export (was inline in old root) |

## Remaining debt (K-58)

- Cosmos onboarding/actions panels still use 6-level relative imports
- Database view controls still use 6-level relative imports
- Consider domain barrels for `query`, `views`, `collections` consumers that import deep paths
- `KnowledgeContextPanel` and sibling panels not yet in a nested `panels/` sub-barrel

## Related docs

- [K-57-import-audit.md](./K-57-import-audit.md)
- [K-57-maintainability-review.md](./K-57-maintainability-review.md)
