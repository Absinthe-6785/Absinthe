# K-92B3A — Cosmos Render Throttle

Branch: `k92b3a-cosmos-render-throttle`

## Scope

Implements three optimizations identified in K-92B3 audit:

1. **P1 — Render throttle:** Commit React render every 4th simulation frame (was every 3rd).
2. **P2 — Layer memoization:** Split SVG graph into memoized `CosmosGalaxyDecorationLayer`, `CosmosOrbitPathLayer`, `CosmosEdgeLayer`, `CosmosNodeLayer`.
3. **P3 — Settling-mode suppression:** Hide labels, nebula, glow filters, orbit paths, and decorative node chrome while force simulation is actively settling.

## Architecture

### Render throttle

- Policy module: `cosmosRenderThrottle.ts`
- `shouldCommitRenderOnSimFrame()` gates `setTick()` during active simulation
- `COSMOS_SIM_SETTLE_RENDER_DIVISOR = 4` (legacy baseline `COSMOS_LEGACY_SIM_RENDER_DIVISOR = 3`)
- On settle completion: `simSettlingRef` cleared and one final `setTick()` ensures stable geometry and restored decorations

### Memo boundaries

- `cosmosGraphLayers.tsx` exports four `memo()` layers
- Parent `NoteGraphView` still re-renders on tick, but layer props isolate geometry vs chrome
- Stable callbacks (`useCallback`) for hover handlers reduce unnecessary layer reconciliation

### Settling suppression

- `simSettling` state + ref track active force simulation
- `shouldSuppressSettleDecorations(simSettling)` passed to all layers
- Galaxy/orbit layers return `null` during settle
- Node layer skips labels, corona, orbit rings, glow filters, folder badges, stars
- Edge layer skips glow filter during settle

## Verification

```bash
npm run typecheck
npm test -- cosmosRenderThrottle k92b3aCosmosRender k92b3CosmosSvg
npm run build
```

## Risk notes

| Risk | Level | Mitigation |
|------|-------|------------|
| Visual regression | Low | Final commit + decoration restore on settle complete |
| Stale rendering | Low | Extra `setTick` when alpha drops below floor |
| Drag responsiveness | Low | Throttle applies only during sim settle; drag uses direct transform |

## Out of scope

Barnes-Hut, workers, canvas renderer, force constant tuning, topology changes.
