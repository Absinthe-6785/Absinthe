# K-92B3C2 — Cosmos Display Position Cache & Parent Index

Branch: `k92b3c2-display-position-cache`

## Changes

1. **Parent index** — `renderMap.get(orbitParentId)` replaces `nodesRef.current.find(...)` (O(1) vs O(n)).
2. **Per-render cache** — `createCosmosDisplayPositionResolver()` deduplicates node position work across edge endpoints.
3. **Callback stability** — resolver factory via `displayPosContext` useMemo; `tick` drives fresh cache per commit, not inline `useCallback` with parent scan.

## Verification

```bash
npm run typecheck
npm test -- cosmosDisplayPositionCache k92b3c2CosmosDisplay k92b3cCosmosRenderMap k92b3CosmosSvg
npm run build
```

## CI stabilization (K-92B3C2)

`k92b3CosmosSvgRenderAudit.ts` memoizes `graphCounts`, `runK92b1ForceSimAudit`, and
`runK92b2bScenarioAudit` per note count. Warm-local tick attribution uses deterministic
`countAlphaTicks` (same value as B2B harness) instead of a full physics run. The post-B2B
assertion uses `runK92b3WarmVsLocalLinkCostSplitCompare()` to share one K-92B1 + one B2B audit.
