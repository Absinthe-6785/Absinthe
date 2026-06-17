# K-92B1 — Cosmos Force Simulation Optimization

Branch: `k92b1-cosmos-force-sim-optimization`  
Reference: [K-92B Cosmos Placement Performance Audit](./K-92B-cosmos-placement-performance-audit.md)  
Status: Audit only — **no production optimizations applied**

---

## Executive Summary

K-92B proved force simulation is **~99.7%** of Cosmos placement time. K-92B1 audits **why** and **what to change first**.

Three critical findings:

1. **O(n²) brute-force repulsion** — no Barnes-Hut, no spatial index; ~129 ticks × n² pair checks @ 500+ nodes.
2. **Full reheat on every sim restart** — `alpha` always resets to **1.0** even when node positions are preserved in `nodesRef`.
3. **`dragging` in sim `useEffect` deps** — every node `mousedown` + `mouseup` **restarts the entire simulation twice** (~3.7s @ 1000 notes on click alone).

Local graph expand (`buildExpandedGraphData`) remains **< 0.2 ms** — not the user-visible hitch.

**Recommended first implementation (highest ROI / lowest risk):** Remove `dragging` from sim effect dependencies; read drag state via ref inside the rAF loop without restarting simulation.

---

## Architecture Map

```text
NoteGraphView.tsx
│
├─ useMemo: buildGlobalGraphData          (~1 ms @ 1k) — NOT bottleneck
│
├─ useEffect [graphData, size]:
│     enrichGraphNodeMeta                 (~3 ms @ 1k)
│     nodesRef init — preserves prior x/y for existing ids (warm positions)
│
└─ useEffect [vaultStructureVersion, indexContentVersion, size, dragging, …]:
      alpha = 1.0                         ← FULL REHEAT every restart
      rAF loop:
        alpha *= 0.97
        O(n²) pairwise repulsion          ← DOMINANT COST
        O(e) link attraction
        O(n) center + galaxy cohesion
        position += velocity * alpha
        setTick every 3rd frame           ← React SVG re-render throttle
```

**Rendering:** React + SVG (not canvas). **Not d3-force** — custom physics in `NoteGraphView.tsx` lines 320–401.

**Local expand path** (`LocalGraphView`): radial layout only — **no force simulation**.

---

## Simulation Lifecycle

| Phase | Behavior | Config |
| ----- | -------- | ------ |
| Mount / dep change | Effect cleanup → cancel rAF → new effect | `alpha = 1.0` |
| Each tick | Repulsion + links + center + cohesion → integrate | `alpha *= 0.97` |
| Velocity damping | Applied per node per tick | `DAMPING = 0.85` |
| Settle criterion | `alpha < alphaFloor` | 0.005 (&lt;250 nodes), **0.02** (≥250) |
| Render | `setTick` when `renderTickRef % 3 === 0` | ~43 React renders @ 129 ticks |
| Stop | No rAF scheduled when `alpha < floor` | Orbit animation continues separately |

**Not present:** `alphaTarget`, Barnes-Hut `theta`, `forceManyBody`, velocity threshold early-stop, max-step cap in production.

---

## Restart Path Analysis

### Sim effect restarts when ANY dep changes:

| Dependency | Typical trigger | Restarts sim? |
| ---------- | --------------- | ------------- |
| `vaultStructureVersion` | Note create/delete/move | **Yes** — expected |
| `indexContentVersion` | Body edit, link change | **Yes** — often unnecessary |
| `size.w / size.h` | Panel resize | **Yes** — debatable |
| **`dragging`** | **Node mousedown/mouseup** | **Yes — BUG/perf issue** |
| `relationshipFilter` | Filter toggle | **Yes** |
| `graphViewMode` | Universe ↔ local mode | **Yes** |
| `reducedMotion` | OS preference | **Yes** |

### Node init vs sim restart (warm-start gap)

```tsx
// Node init preserves positions:
const prior = existing[node.noteId];
const base = prior ?? { x: random, y: random, ... };

// But sim ALWAYS restarts with alpha = 1.0 — positions preserved, energy not.
```

**Partial warm-start exists for positions but not for simulation energy.**

### Local expand does NOT restart Cosmos sim

`handleExpandGraphNode` → `buildExpandedGraphData` → `LocalGraphView` radial layout. **Does not touch `NoteGraphView` force loop.**

---

## Hotspot Attribution @ 1000 notes

Measured via `k92b1CosmosForceSimAudit.ts` (Vitest, `buildLargeVaultDataset`).

| Operation | Time | % of path |
| --------- | ---- | --------- |
| O(n²) force sim settle (cold) | **1,859 ms** | **99.99%** |
| Expand node (local graph) | 0.19 ms | 0.01% |
| **Total placement path** | **1,859 ms** | 100% |

Pair iterations per cold settle @ 1000: **129 ticks × ~499,500 pairs ≈ 64M pair evaluations**.

---

## Deliverable B — Benchmark Table

| Notes | Expand node | Cold sim settle | Warm reheat (α=0.2) | Double restart (click) | Raised floor (0.05) | Total path | Cold ticks |
| ----: | ----------: | --------------: | ------------------: | ---------------------: | ------------------: | ---------: | ---------: |
| 100 | 0.10 ms | 31.8 ms | 16.2 ms | 63.5 ms | 13.6 ms | 31.9 ms | 174 |
| 300 | 0.08 ms | 150.9 ms | 87.9 ms | 301.7 ms | 106.1 ms | 151.0 ms | 129 |
| 500 | 0.10 ms | 374.2 ms | 218.1 ms | 748.5 ms | 355.8 ms | 374.3 ms | 129 |
| 1000 | 0.19 ms | **1,858.7 ms** | **830.0 ms** | **3,717.4 ms** | **1,089.7 ms** | **1,858.9 ms** | 129 |

**Interpretation:**

- **Expand node:** negligible at all scales (Cosmos hitch is not local expand).
- **Cold sim:** scales ~O(n²); dominates total path.
- **Warm reheat (α=0.2):** **−55%** @ 1000 vs cold — models vault edit with preserved positions.
- **Double restart:** models current click path (`dragging` dep) — **2× cold settle**.
- **Raised floor (0.05):** **−41%** @ 1000 — fewer ticks, slightly looser layout.

Run: `npm test -- k92b1CosmosForceSim`

---

## Scaling Model

```text
T(n) ≈ ticks(αFloor) × C × n²

ticks ≈ 129 for αFloor=0.02, decay=0.97
C ≈ repulsion + link + cohesion constant factors
```

| n | n² | Measured T | T/n² (μs) |
| --: | ---: | -------: | --------: |
| 100 | 10⁴ | 32 ms | 3.2 |
| 300 | 9×10⁴ | 151 ms | 1.7 |
| 500 | 2.5×10⁵ | 374 ms | 1.5 |
| 1000 | 10⁶ | 1,859 ms | 1.9 |

Quadratic scaling confirmed. Edge count (24–249) does not reduce repulsion cost — **all pairs computed regardless of graph sparsity**.

Theoretical Barnes-Hut @ θ=0.9, n=1000: **~25×** pair-loop speedup (see `estimateBarnesHutSpeedup(1000)` ≈ 25 in audit).

---

## Audit Area Findings

### 1. Force simulation configuration

| Parameter | Production value | Notes |
| --------- | ---------------- | ----- |
| `initialAlpha` | 1.0 | Full reheat every restart |
| `alphaTarget` | **none** | Not used |
| `alphaDecay` | 0.97 / tick | ~129 ticks to reach floor @ 0.02 |
| `velocityDecay` | 0.85 | Applied before position integration |
| `alphaFloor` | 0.005 (&lt;250), 0.02 (≥250) | From `graphScalePolicy.ts` |
| `REPEL` | 3200→1400 by tier | Inverse-square repulsion |
| Settle | alpha decay only | No velocity threshold stop |

### 2. Simulation restart on expand

**Local expand:** does not restart Cosmos sim.  
**Cosmos click:** `onMouseDown` → `setDragging(id)` → **full sim restart** → `mouseup` → **second restart**.

### 3. Warm-start opportunities

| Strategy | Measured @ 1k | Effort | Risk |
| -------- | --------------: | ------ | ---- |
| Preserve positions (already done) | positions kept | — | Low |
| Partial reheat α=0.2 | **830 ms (−55%)** | Low | Low–Med |
| Skip sim if max velocity &lt; ε | ~0 ms (settled graph) | Med | Med |
| Only sim new nodes (local region) | not measured | High | Med |

### 4. Incremental simulation

No incremental sim today. Candidates: local neighborhood relaxation (k-hop around changed nodes), bounded region reheat, split static/settling node sets.

### 5. Web Worker feasibility

| Aspect | Assessment |
| ------ | ---------- |
| Current | Sim + SVG render on main thread |
| Worker gain | Frees main thread during settle; **~30–50%** perceived hitch reduction |
| Cost | Serialize nodes/edges each tick OR batch full settle in worker; sync back to `nodesRef` |
| Complexity | **High** — drag interaction, universe orbit overlay, React tick coupling |
| Recommendation | **Phase 2** after algorithm fixes |

### 6. Barnes-Hut / forceManyBody

**Not implemented.** Production uses nested `for i/for j` inverse-square repulsion. No `theta` tuning exists. Adding Barnes-Hut or a spatial hash grid is the largest **algorithmic** win (~25× pair loop @ 1k theoretical).

### 7. Tick throttling

| Metric | Value |
| ------ | ----- |
| Physics ticks @ 1k | 129 |
| React `setTick` calls | ~43 (every 3rd tick) |
| Minimum acceptable | ~15–20 visible frames for settle (user testing needed) |
| Early-stop candidate | Stop when `max(|vx|,|vy|) < ε` — could cut 20–40% ticks |

---

## Deliverable C — Optimization Ranking

| Rank | Optimization | Expected gain @ 1k | Effort | Regression risk |
| ---- | ------------ | -----------------: | ------ | --------------- |
| **1** | **Remove `dragging` from sim effect deps** (use ref) | **Eliminate 2× restart on click (~3.7s)** | **Low** | **Low** |
| 2 | Partial reheat when &gt;90% nodes have prior positions (α=0.2) | **−55%** settle on vault edit | Low | Low–Med |
| 3 | Raise `alphaFloor` at galaxy tier (0.02→0.05) | **−41%** settle | Low | Med (layout drift) |
| 4 | Velocity threshold early-stop | −20–40% ticks | Low | Low |
| 5 | Barnes-Hut / spatial hash repulsion | **−80–95%** pair loop | **High** | Med |
| 6 | Decouple `indexContentVersion` from sim restart | Variable (edit-heavy users) | Med | Med |
| 7 | Web Worker sim | Main-thread hitch −30–50% | High | Med |
| 8 | Canvas render layer | React SVG cost reduction | High | Med |
| 9 | Local neighborhood sim only | Unknown | High | Med–High |

---

## Deliverable D — Recommended Implementation Plan

### Phase 1 (implement first): **Drag-decoupled sim restart**

**Change:** Move `dragging` to `draggingRef.current`; remove from `useEffect` dependency array. Inside `step()`, skip integration for dragged node (already done via `if (n.id === dragging) return` — use ref instead).

**Expected impact:**

- Click/preview path: **−2× cold settle** (~1.9s saved @ 1k per click cycle)
- Drag still works without restarting simulation
- **Lowest effort, lowest risk, highest user-visible ROI**

### Phase 2: **Partial reheat on warm-start**

When node init preserves &gt;90% prior positions, start `alpha = 0.15–0.25` instead of 1.0.

**Expected:** −40–55% settle time on vault edits (not first mount).

### Phase 3: **Barnes-Hut repulsion**

Replace O(n²) pair loop with quadtree Barnes-Hut (θ ≈ 0.8–1.0).

**Expected:** −80%+ pair loop @ 500+ nodes; enables 1000+ node universe at &lt;200 ms settle.

### Defer

- Web Worker (after algorithm fix — otherwise worker still runs O(n²))
- Local expand optimization (already &lt;1 ms)
- `buildGlobalGraphData` caching

---

## Risk Assessment

| Change | Risk | Mitigation |
| ------ | ---- | ---------- |
| Drag ref decoupling | Low | Existing drag skip logic; add integration test |
| Partial reheat | Low–Med | Visual snapshot tests @ 250/500 nodes |
| Raised alpha floor | Med | A/B universe layout review |
| Barnes-Hut | Med | Compare positions vs brute force on fixture vaults |
| Web Worker | Med–High | Fallback to main-thread path |

**Safe-to-merge (audit branch):** N/A — audit only, no production changes.

**Safe-to-merge (Phase 1 implementation):** **Yes, after review** — drag ref change is isolated, measurable, reversible.

---

## Verification

```bash
cd frontend
npm run typecheck   # ✓
npm test            # ✓ (includes k92b1CosmosForceSim + k92bCosmosPlacement)
npm run build       # ✓
npm test -- k92b1CosmosForceSim
```

---

## File Inventory (this audit)

| File | Status |
| ---- | ------ |
| `frontend/docs/K-92B1-cosmos-force-sim-optimization.md` | **New** |
| `frontend/src/components/views/k92b1CosmosForceSimAudit.ts` | **New** |
| `frontend/src/components/views/k92b1CosmosForceSimAudit.test.ts` | **New** |

**Production code modified:** none

---

## References

- `frontend/src/components/views/NoteGraphView.tsx` — sim loop lines 320–401
- `frontend/src/components/views/graphScalePolicy.ts` — alpha floor, repulsion tiers
- `frontend/src/components/views/k92bCosmosPlacementAudit.ts` — K-92B baseline
- `frontend/docs/K-92B-cosmos-placement-performance-audit.md`
