# K-92B — Cosmos Node Placement Performance Audit

Branch: `k92b-protein-units-and-cosmos-performance`  
Reference: [K-31 Graph Scale Audit](./K-31-graph-scale-audit.md), [K-89C Large Vault Performance](./K-89C-large-vault-performance.md)  
Status: Audit only — **no optimizations applied**

---

## Executive Summary

User-reported Cosmos lag (“click → frame hitch → node appears”) is **not** dominated by graph data rebuild or local expand placement. Measured bottleneck:

**Force-directed simulation settle in `NoteGraphView`** — O(n²) pairwise repulsion per frame until alpha decays (~500 steps max). At **1000 notes: ~1,583 ms (99.7%)** of the measured interaction path.

Supporting facts:

- **`buildGlobalGraphData`** — full vault rebuild, O(n + e), **< 2 ms @ 1000 notes**
- **`enrichGraphNodeMeta`** — galaxy/orbit/tier pass, **< 3 ms @ 1000 notes**
- **Local graph expand** (`buildExpandedGraphData` + radial layout) — **< 0.2 ms**; **incremental**, not full vault
- **Preview click prep** (focus depth + orbit paths) — **< 0.1 ms**

Cosmos uses **SVG + React** (`NoteGraphView.tsx`), not canvas. Animation loop uses `requestAnimationFrame` + `setTick` (throttled every 3 frames).

---

## Architecture Overview

```text
NoteView
  ├─ Cosmos tab → NoteGraphView (full vault, force sim, universe mode)
  └─ Relations → Graph tab → LocalGraphView (radial layout, expand/collapse)

KnowledgeIndexService (prebuilt index)
  ↓
buildGlobalGraphData          ← O(n + edges) full vault
  ↓
enrichGraphNodeMeta           ← galaxy clustering, orbit hierarchy, tier/importance
  ↓
NoteGraphView useEffect       ← node ref init / preserve positions
  ↓
Force simulation rAF loop     ← O(n²) repulsion × ~500 steps (DOMINANT)
  ↓
React SVG render (tick)       ← nodes, edges, nebula, orbit paths
```

Local expand path (Relations panel):

```text
click expand on LocalGraphView node
  ↓
handleExpandGraphNode (useNoteCrudActions)
  ↓
setExpandedGraphNodes
  ↓
buildExpandedGraphData        ← incremental neighborhood merge (NOT full vault)
  ↓
computeRadialLayout           ← O(n × hops), small n
  ↓
LocalGraphView SVG render
```

---

## Call Graph — Node Appears (two surfaces)

### A. Cosmos universe (`NoteGraphView`)

| Step | Function | File |
| ---- | -------- | ---- |
| 1 | User clicks node circle | `NoteGraphView.tsx` → `setPreviewNodeId` |
| 2 | Focus cluster recompute | `buildFocusUniverseDepthMap` |
| 3 | Orbit / nebula visuals | `buildOrbitPaths`, `buildGalaxyVisuals` |
| 4 | React re-render SVG | `NoteGraphView` render (depends on `tick`) |

**Cold open / vault change** additionally runs steps before click:

| Step | Function | Cost @ 1k |
| ---- | -------- | --------- |
| Graph data | `buildGlobalGraphData` | ~1.3 ms |
| Meta enrich | `enrichGraphNodeMeta` | ~2.7 ms |
| Sim restart | force loop `useEffect` deps | **~1,583 ms** |

Force sim `useEffect` deps: `vaultStructureVersion`, `indexContentVersion`, `size`, `dragging`, `relationshipFilter`, `graphViewMode` — **any vault edit restarts full settle**.

### B. Local graph expand (`LocalGraphView`)

| Step | Function | File |
| ---- | -------- | ---- |
| 1 | Expand button click | `LocalGraphView.tsx` → `onExpandNode` |
| 2 | State update | `handleExpandGraphNode` → `expandNode` |
| 3 | Graph rebuild | `buildExpandedGraphData` (incremental) |
| 4 | Layout | `computeRadialLayout` |
| 5 | Render | SVG nodes/edges |

Measured expand data path **< 0.2 ms** @ 500 notes — not user-visible hitch source.

---

## Graph Recomputation Scope

| Surface | Trigger | Scope |
| ------- | ------- | ----- |
| Cosmos `NoteGraphView` | Vault version, content version, filter, mode, resize | **Full vault** graph data + **full** meta enrich + **sim restart** |
| Local `LocalGraphView` | Expand/collapse, center note change | **Incremental** — center neighborhood + expanded hop-2 merges only |
| Node position preserve | Cosmos re-init | Existing `nodesRef` positions kept when `prior` node exists |

---

## Layout Cost Breakdown

| Component | Algorithm | Complexity | @ 1000 notes |
| --------- | --------- | ---------- | ------------ |
| Force repulsion | All pairs | O(n²) × steps | **~1,583 ms** |
| Link attraction | Per edge | O(e) × steps | included above |
| Galaxy cohesion | Per node | O(n) × steps | included above |
| `computeGalaxyCenters` | Per galaxy | O(n) | negligible |
| `enrichGraphNodeMeta` | Galaxy map + orbit | O(n)–O(n²) worst case | ~2.7 ms |
| `computeRadialLayout` | Ring placement | O(n²) `find` in loop | ~0.04 ms (local n≈24) |
| `buildOrbitPaths` | Preview click | O(n) | ~0.1 ms |

---

## Render Cost

| Layer | Technology | Notes |
| ----- | ---------- | ----- |
| Cosmos | React + SVG | Full node/edge list re-rendered on `tick` (throttled 1/3 frames during sim) |
| Local graph | React + SVG | Small subgraph (~24 nodes typical) |
| Animation | `requestAnimationFrame` | Runs until `alpha < alphaFloor` (0.02 @ 500+ nodes) |
| HUD | `buildCosmosVaultAnalysis`, `buildDiscoveryFeed` | Deferred via `requestIdleCallback` — not on click hot path |

React SVG render time for 1000 nodes **not isolated** in this audit (likely 10–40 ms per tick during sim); still secondary to **1.5s+ sim settle**.

---

## Measured Benchmarks

Harness: `k92bCosmosPlacementAudit.ts` — `npm test -- k92bCosmosPlacement`  
Environment: Vitest, `buildLargeVaultDataset`, median of 3 iterations per phase.

### @ 100 notes

| Operation | Time | % |
| --------- | ---- | - |
| buildGlobalGraphData (full vault) | 0.21 ms | 0.5% |
| enrichGraphNodeMeta (galaxy/orbit/tier) | 0.51 ms | 1.3% |
| Cosmos graph node init | 0.02 ms | 0% |
| **Force simulation settle** | **38.04 ms** | **97.3%** |
| buildExpandedGraphData (local, pre-expand) | 0.07 ms | 0.2% |
| buildExpandedGraphData (+1 expand click) | 0.10 ms | 0.3% |
| computeRadialLayout (LocalGraphView) | 0.05 ms | 0.1% |
| Preview click render prep | 0.10 ms | 0.3% |
| **Total measured path** | **39.11 ms** | 100% |

### @ 300 notes

| Operation | Time | % |
| --------- | ---- | - |
| buildGlobalGraphData | 0.55 ms | 0.4% |
| enrichGraphNodeMeta | 1.65 ms | 1.1% |
| Force simulation settle | **149.20 ms** | **98.4%** |
| buildExpandedGraphData (+1 expand) | 0.07 ms | 0% |
| computeRadialLayout | 0.01 ms | 0% |
| **Total** | **151.67 ms** | 100% |

### @ 500 notes

| Operation | Time | % |
| --------- | ---- | - |
| buildGlobalGraphData | 0.66 ms | 0.2% |
| enrichGraphNodeMeta | 1.11 ms | 0.3% |
| Force simulation settle | **403.83 ms** | **99.5%** |
| buildExpandedGraphData (+1 expand) | 0.04 ms | 0% |
| **Total** | **405.78 ms** | 100% |

### @ 1000 notes

| Operation | Time | % |
| --------- | ---- | - |
| buildGlobalGraphData | 1.28 ms | 0.1% |
| enrichGraphNodeMeta | 2.68 ms | 0.2% |
| Force simulation settle | **1,583.07 ms** | **99.7%** |
| buildExpandedGraphData (+1 expand) | 0.09 ms | 0% |
| computeRadialLayout | 0.04 ms | 0% |
| Preview click render prep | 0.10 ms | 0% |
| **Total** | **1,587.35 ms** | 100% |

### Scaling summary

| Notes | Force sim | Total path | Global edges |
| ----: | --------: | ---------: | -----------: |
| 100 | 38 ms | 39 ms | 24 |
| 300 | 149 ms | 152 ms | 74 |
| 500 | 404 ms | 406 ms | 124 |
| 1000 | **1,583 ms** | **1,587 ms** | 249 |

Force sim scales **~O(n²)** with note count (sparse vault edges do not reduce repulsion loop).

---

## Bottleneck Ranking

| Rank | Bottleneck | Evidence | Severity @ 500+ notes |
| ---- | ---------- | -------- | --------------------- |
| 1 | **Force simulation full settle** | 99%+ of path; 1.6s @ 1k | **Critical** |
| 2 | React SVG re-render during sim ticks | Not measured; user sees jank during 1.5s settle | High |
| 3 | Sim restart on vault/content version change | `useEffect` deps restart from alpha=1 | High |
| 4 | enrichGraphNodeMeta | < 3 ms @ 1k | Low |
| 5 | buildGlobalGraphData | < 2 ms @ 1k | Low |
| 6 | Local expand / radial layout | < 1 ms | Negligible |

---

## Ranked Follow-Up Branches

| Branch | Scope | Expected gain | Risk |
| ------ | ----- | ------------- | ---- |
| **K-92B1 Cosmos Force Sim Optimization** | Web Worker sim, Barnes-Hut or limit max steps, warm-start from prior positions | **60–90%** settle time @ 500+ | Medium |
| **K-92B2 Cosmos Incremental Sim Restart** | Do not reset alpha=1 on minor vault edits; patch node positions only | Fewer full 1.5s hitches | Medium |
| **K-92B3 Cosmos SVG Render Throttle** | Canvas layer or virtualized SVG during sim; reduce tick React work | Smoother frames during settle | Medium |
| **K-92B4 Protein Unit UX + Item Label** | See [K-92B protein proposal](./K-92B-protein-unit-flexibility-proposal.md) | UX clarity (not perf) | Low |

**Do not prioritize:** local graph expand optimization, `buildGlobalGraphData` caching (already sub-ms).

---

## Risk Assessment

| Area | Level | Notes |
| ---- | ----- | ----- |
| K-92B1 sim changes breaking layout | Medium | Universe orbit/galaxy positions are sim-dependent |
| Worker offload complexity | Medium | Must sync `nodesRef` + dragging |
| Incremental sim correctness | Medium | New nodes need placement without full reheat |
| Local graph expand | Low | Already fast |
| Protein unit migration | Low | Additive column only |

**Overall Cosmos perf risk for optimization:** Medium — sim is core UX; changes need visual regression on universe mode.

---

## Verification

```bash
cd frontend
npm run typecheck   # ✓
npm test            # ✓ (includes k92bCosmosPlacement)
npm run build       # ✓
npm test -- k92bCosmosPlacement
```

---

## File Inventory (this audit)

| File | Status |
| ---- | ------ |
| `frontend/docs/K-92B-cosmos-placement-performance-audit.md` | **New** — this document |
| `frontend/docs/K-92B-protein-unit-flexibility-proposal.md` | **New** — Workstream A |
| `frontend/src/components/views/k92bCosmosPlacementAudit.ts` | **New** — benchmark harness |
| `frontend/src/components/views/k92bCosmosPlacementAudit.test.ts` | **New** — scaling tests |

**Modified production code:** none

---

## References

- `frontend/src/components/views/NoteGraphView.tsx` — force loop, SVG render
- `frontend/src/components/views/features/knowledge/graph/buildGlobalGraphData.ts`
- `frontend/src/components/views/features/knowledge/graph/buildExpandedGraphData.ts`
- `frontend/src/components/views/features/knowledge/graph/LocalGraphView.tsx`
- `frontend/src/components/views/graphScalePolicy.ts`
