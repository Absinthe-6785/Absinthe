# K-92B3 — Cosmos SVG Render Throttle Audit

**Branch:** `k92b3-cosmos-svg-render-audit`  
**Reference:** [K-92B1](./K-92B1-cosmos-force-sim-optimization.md), [K-92B2A](./K-92B2A-graph-signature-restart-gate.md), [K-92B2B](./K-92B2B-incremental-local-reheat.md)  
**Status:** Audit only — **no production behavior changes**  
**Scope:** Render attribution, SVG update audit, sim vs React/SVG split after K-92B1A/B1B/B2A/B2B

---

## Executive Summary

After K-92B2A/B2B, simulation cost dropped sharply for metadata-only and edge-only topology edits. **Opening Cosmos (cold settle) and warm-full node changes still combine simulation + React/SVG work.**

**Verdict by scenario @ 1000 notes:**

| User path | Dominant cost | Answer |
|-----------|---------------|--------|
| **Open Cosmos tab (cold settle)** | Sim ~46%, React ~35%, SVG ~20% | **C — both** (sim still largest single bucket) |
| **Warm-full topology (note add/remove)** | Sim ~45%, React ~35% | **C — both** |
| **Edge-only local reheat (link add)** | React ~64%, Sim ~0.3% | **B — React/SVG rendering** |
| **Metadata-only edit** | 0 sim restarts (K-92B2A) | N/A — render not in settle path |

Remaining “click Cosmos → frame drops until settled” is **primarily cold-open settle**: ~129 sim ticks, ~43 React commits, ~8100 SVG attr writes per commit @ 1000 notes.

---

## A. Render Attribution Report

Production policy (from `NoteGraphView.tsx`):

- `setTick` fires every **3rd** sim rAF frame during settle (`renderTickRef % 3`)
- `tick` state triggers **full `NoteGraphView` re-render** (no memoized node/edge layers)
- **6 tick-dependent useMemos** recompute per commit: `matchedIds`, `focusDepthMap`, `focusNeighborhood`, `galaxyVisuals`, `orbitPaths`, `getDisplayPos`

Run: `npm test -- k92b3CosmosSvg`

| Notes | Scenario | Sim ticks | rAF frames | React commits | Commits/s | Nodes/commit | Edges/commit |
| ----: | -------- | --------: | ---------: | ------------: | --------: | -----------: | -----------: |
| 100 | cold_open | 174 | 174 | 58 | 20.0 | 100 | 24 |
| 300 | cold_open | 129 | 129 | 43 | 20.0 | 300 | 74 |
| 500 | cold_open | 129 | 129 | 43 | 20.0 | 500 | 124 |
| 1000 | cold_open | 129 | 129 | **43** | 20.0 | 1000 | 249 |
| 1000 | warm_full | 76 | 76 | **26** | 20.5 | 1000 | 249 |
| 1000 | warm_local_link | 76 | 76 | **26** | 20.5 | 1000 | 249 |

**Per commit @ 1000:** reconciles **1000 node JSX trees + 249 edge lines + 6 memo passes**. Tick count unchanged by B2B; commit count unchanged by B2B.

---

## B. SVG Update Audit

Universe mode, realistic vault fixture. Static estimate from JSX structure.

| Notes | SVG elems (est) | Circles | Lines | Labels | **Attr writes/commit** |
| ----: | --------------: | ------: | ----: | -----: | ---------------------: |
| 100 | 443 | 320 | 24 | 35 | 814 |
| 300 | 1,243 | 960 | 74 | 105 | 2,437 |
| 500 | 2,027 | 1,600 | 124 | 175 | 4,057 |
| 1000 | 3,987 | 3,200 | 249 | 350 | **8,107** |

### Hottest SVG operations (ranked)

1. **Edge `<line>` x1/y1/x2/y2** — every commit, all edges
2. **Node `<circle>` cx/cy** — ~3.2 circles/node × commits
3. **Label `<text>` x/y** — ~35% of nodes show labels @ zoom
4. **`filter="url(#ku-star-glow)"`** — blur on star-tier nodes
5. **`g` opacity** — focus dimming reconciliation
6. **Galaxy nebula circles** — universe backdrop
7. **Orbit path circles** — ~12% of nodes
8. **Hit-target transparent circles** — pointer capture
9. **`marker-end` arrowheads** on edges
10. **Root `<g transform>`** — pan/zoom (user input, not settle)

---

## C. Simulation vs Rendering Breakdown

Modeled split: measured sim ms from `runK92b1ForceSimAudit` + calibrated React/SVG ms from commits × nodes/edges × attr writes.  
(Local link sim ms scaled by B2B pair-iteration ratio.)

| Notes | Scenario | Sim ms | React ms | SVG ms | Sim % | React % | SVG % | Dominant |
| ----: | -------- | -----: | -------: | -----: | ----: | ------: | ----: | -------- |
| 100 | cold_open | 46 | 53 | 17 | 5% | 72% | 23% | react |
| 300 | cold_open | 343 | 79 | 37 | 20% | 55% | 25% | react |
| 500 | cold_open | 900 | 119 | 61 | 29% | 47% | 24% | react |
| **1000** | **cold_open** | **3535** | **219** | **122** | **46%** | **35%** | **19%** | **mixed** |
| 1000 | warm_full | 2020 | 133 | 74 | 45% | 35% | 20% | mixed |
| 1000 | warm_local_link | 8 | 133 | 74 | **0.3%** | **64%** | **36%** | **react** |

**Interpretation:**

- **@ 1000 cold open:** simulation and rendering are **comparable** — neither alone explains all jank.
- **@ 1000 after B2B link edit:** simulation is negligible; **React+SVG is the bottleneck**.
- **@ 100–500:** modeled React share higher (sim ms lower in harness vs commit overhead floor).

---

## D. Top 10 Hotspots

| Rank | ID | Layer | Description |
| ---: | -- | ----- | ------------- |
| 1 | sim_o_n2_repulsion | sim | O(n²) repulsion each tick (B2B reduces pairs on edge-only edits only) |
| 2 | react_full_tree_on_tick | react | Full NoteGraphView re-render on every `setTick` |
| 3 | svg_edge_line_coords | svg | All edge lines update coordinates each commit |
| 4 | svg_node_circle_coords | svg | Multiple circles per node update cx/cy |
| 5 | tick_usememos | react | 6 useMemos keyed on `tick` |
| 6 | getDisplayPos_orbit | react | Orbit math + parent lookup per node/edge |
| 7 | mount_enrich_meta | mount | `enrichGraphNodeMeta` on tab open |
| 8 | svg_filters_glow | svg | Gaussian blur filters on stars/planets |
| 9 | visible_maps_inline | react | `visibleNodes`/`visibleEdges` not memoized |
| 10 | sim_ticks_constant | sim | 76–129 ticks per settle regardless of B2B local reheat |

---

## E. Ranked Optimization Roadmap

| Rank | Proposal | Expected gain | Risk | Effort |
| ---: | -------- | ------------- | ---- | ------ |
| 1 | Increase render divisor N=4–5 during sim | 20–33% fewer commits | low | low |
| 2 | `React.memo` NodeLayer / EdgeLayer | 30–50% React during settle | low | med |
| 3 | Ref-based SVG cx/cy patch during settle | 40–60% React+SVG | med | med |
| 4 | Hide labels/nebula until settled | 15–25% SVG writes | low | low |
| 5 | Decouple tick from galaxy/orbit memos | 10–20% React/commit | low | low |
| 6 | Canvas edge layer | 50–70% edge SVG cost | med | high |
| 7 | Single commit after offscreen settle | 95%+ commit reduction | med | med |
| 8 | Worker sim (deferred) | Main thread free | high | high |
| 9 | Barnes-Hut (deferred) | Large sim ms drop | med | high |
| 10 | Offscreen prerender + spinner | Eliminate visible jank | med | med |

**Do not implement Barnes-Hut, workers, or force-constant changes in the render throttle branch.**

---

## F. Recommended Next Implementation Branch

**Branch:** `k92b3a-cosmos-render-throttle`

**Scope:**

1. Sim-phase render divisor N=4 or N=5 (keep N=3 after settle / during drag)
2. Memoized `CosmosNodeLayer` / `CosmosEdgeLayer`
3. Suppress labels + galaxy nebula while `alpha >= alphaFloor`

**Rationale:** Post-B2B, link-edit path is render-dominated; cold-open is mixed. Lowest-risk ROI targets **commit frequency and reconciliation scope** before canvas rewrites.

---

## Risk Assessment

| Risk | Level | Notes |
|------|-------|-------|
| Higher render divisor causes visible stutter | Low | Still 15–20 commits @ 1000 cold; test UX |
| Memo layers stale props | Med | Pass only geometry + selection flags |
| Ref-patch bypasses React a11y | Med | Keep React tree for interaction; patch positions only |
| Hide labels during settle | Low | Restore on settle complete |
| Mis-attributing modeled React ms | Med | Harness uses calibrated model; validate with Profiler in K-92B3A |

---

## File Inventory

| File | Role |
|------|------|
| `frontend/src/components/views/k92b3CosmosSvgRenderAudit.ts` | Audit harness + cost model |
| `frontend/src/components/views/k92b3CosmosSvgRenderAudit.test.ts` | Benchmark printer + policy tests |
| `frontend/docs/K-92B3-cosmos-svg-render-audit.md` | This report |

**Production files reviewed (unchanged):**

- `NoteGraphView.tsx` — sim loop, `setTick` throttle, SVG JSX
- `k92b1CosmosForceSimAudit.ts` — sim ms/tick baselines
- `k92b2bIncrementalLocalReheatAudit.ts` — post-B2B sim reduction

---

## Verification

```bash
cd frontend
npm run typecheck
npm test -- k92b3CosmosSvg
npm test
npm run build
```

All passed on audit branch (no production edits).

---

## Safe-to-Implement Recommendation

**Proceed with K-92B3A render throttle** (items 1, 2, 4 above). **Defer** canvas edges, worker sim, and Barnes-Hut.

Audit-only branch is complete — **no commit** per workflow.

---

## Out of Scope Notes (future work, not this branch)

**Protein tracker (user follow-up):**

- Explicit unit selection: Per Item / Per 100g
- Custom item labels: scoop, egg, piece, serving, etc.
- Existing protein math unchanged
