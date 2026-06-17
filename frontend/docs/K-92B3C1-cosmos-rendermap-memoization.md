# K-92B3C1 — Cosmos RenderMap Memoization

Branch: `k92b3c1-rendermap-memoization`

## Change

Memoize `renderMap` on `graphTopologySignature` only. Node positions mutate in-place during simulation; Map values remain valid until topology changes.

```typescript
const renderMap = useMemo(
  () => buildCosmosRenderMapFromNodes(nodesRef.current),
  [graphTopologySignature],
);
```

## Dependency rationale

| Candidate | Selected? | Why |
|-----------|-----------|-----|
| `graphTopologySignature` | **Yes** | Rebuild when nodes/edges change; not on tick |
| `+ showIsolated` | No | Isolated filter does not change `nodesRef` membership |
| `+ node set identity` | No | Redundant with topology signature |

## Verification

```bash
npm run typecheck
npm test -- cosmosRenderMapMemo k92b3c1CosmosRenderMap k92b3cCosmosRenderMap
npm run build
```
