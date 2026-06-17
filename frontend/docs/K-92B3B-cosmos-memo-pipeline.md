# K-92B3B — Tick-Decoupled Cosmos Memo Pipeline

Branch: `k92b3b-cosmos-memo-pipeline`

## Scope

Decouple expensive NoteGraphView memo chains from simulation `tick` updates while preserving K-92B3A render throttle behavior.

## Changes

| Priority | Target | Approach |
|----------|--------|----------|
| P1 | `visibleNodes` / `visibleEdges` | `buildVisibleGraphSnapshot()` memoized on `graphTopologySignature` + `showIsolated` |
| P2 | `galaxyVisuals` | `buildGalaxyVisualTopology()` memo + `resolveGalaxyVisualsFromTopology()` per render |
| P3 | `orbitPaths` | `buildOrbitPathTopology()` memo + `resolveOrbitPathsFromTopology()` per render |
| P4 | `focusDepthMap` / `focusNeighborhood` | Removed `tick` from useMemo deps |

## Verification

```bash
npm run typecheck
npm test -- cosmosGraphMemoPipeline k92b3bCosmosMemo
npm run build
```
