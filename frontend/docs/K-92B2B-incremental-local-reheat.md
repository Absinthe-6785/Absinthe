# K-92B2B — Incremental Local Reheat

**Branch:** `k92b2b-incremental-local-reheat`  
**Reference:** [K-92B2A](./K-92B2A-graph-signature-restart-gate.md), [K-92B2](./K-92B2-incremental-sim-restart-audit.md)  
**Status:** Implemented — localized warm reheat on topology change  
**Scope:** Local integration set + fallback to full warm settle

---

## Architecture Summary

After K-92B2A, metadata-only edits skip sim restart. Topology edits still restart the force loop at **α=0.2** but previously integrated **every node every tick** (76 warm ticks @ 500+ notes, O(n²) pairs per tick).

K-92B2B adds a **local reheat plan** at effect start:

```text
topology diff(prevSignature, nextSignature)
  → dirty seeds (added/removed nodes, changed edge endpoints, neighbors of removed nodes)
  → BFS expand hops=2 on current graph
  → if |active| ≤ 20% of n AND ≤ 200 nodes AND bulk change ≤ 10 nodes
        local_reheat(activeSet)
     else warm_full (unchanged K-92B1B path)
```

During local reheat:

- Repulsion / link forces only on pairs touching `activeSet`
- Center gravity + galaxy cohesion only on `activeSet`
- Position integration only on `activeSet` (others fixed)
- Tick count unchanged (same α decay); **settle cost** drops via fewer pair iterations per tick

Production wiring: `NoteGraphView.tsx` force loop + `cosmosLocalReheat.ts` policy module.

---

## File Inventory

| File | Role |
|------|------|
| `frontend/src/components/views/cosmosLocalReheat.ts` | Diff, neighborhood, fallback policy |
| `frontend/src/components/views/cosmosLocalReheat.test.ts` | Policy unit tests |
| `frontend/src/components/views/NoteGraphView.tsx` | Local integration in force loop |
| `frontend/src/components/views/k92b1CosmosForceSimAudit.ts` | `activeNodeIds` support in settle harness |
| `frontend/src/components/views/k92b2bIncrementalLocalReheatAudit.ts` | Benchmark + quality harness |
| `frontend/src/components/views/k92b2bIncrementalLocalReheatAudit.test.ts` | Verification tests |
| `frontend/docs/K-92B2B-incremental-local-reheat.md` | This document |

---

## Benchmark Table (2-hop, production policy)

Run: `npm test -- k92b2bIncremental`

**Edge-only local reheat (`link_add_1`):**

| Notes | Seeds | Local nodes | Restarts | Ticks | Warm pairs | Local pairs | Cost Δ | Max active Δpx | Mode |
| ----: | ----: | ----------: | -------: | ----: | ---------: | ----------: | -----: | -------------: | ---- |
| 100 | 1 | 2 | 1 | 122 | 603,900 | 24,034 | 96.0% | 10.3 | local_reheat |
| 300 | 1 | 2 | 1 | 76 | 3,408,600 | 45,372 | 98.7% | 3.5 | local_reheat |
| 500 | 1 | 2 | 1 | 76 | 9,481,000 | 75,772 | 99.2% | 9.5 | local_reheat |
| 1000 | 1 | 2 | 1 | 76 | 37,962,000 | 151,772 | **99.6%** | 14.3 | local_reheat |

**Node add/remove (`note_add_1`, `note_remove_1`):** fall back to **warm_full** (quality audit showed 19–83px displacement with local integration).

Ticks unchanged from K-92B1B warm path; savings are **pair iterations per tick** (settle cost).

---

## Visual Risk Analysis

### 1. Can local reheat replace full warm restart?

**Yes for edge-only topology changes** (wiki link add/remove). Audit shows ≤14.3px max displacement on active nodes @ 1000 notes with **99.6% pair-cost reduction**.

**No for node add/remove** — local integration produced 19–83px displacement vs warm-full reference; production policy falls back to warm full.

### 2. What hop radius is safest?

| Hops | Cost | Quality |
|:----:|------|---------|
| 0 (endpoints only) | Best cost | Risky — boundary artifacts on note add |
| 1 | Moderate savings | Can exceed quality threshold on note add |
| **2 (production)** | **~30–99% pair reduction** | **Passes quality gate in audit** |

**Recommendation:** **2-hop** as production default (`COSMOS_LOCAL_REHEAT_HOPS = 2`).

### 3. When must we fall back to full warm restart?

| Condition | Reason |
|-----------|--------|
| First mount / no preserved nodes | Cold full (α=1.0) |
| Mode, filter, or reduced-motion change | Cold full |
| Panel resize | Warm full (global center shift) |
| `\|added nodes\| > 0` or `\|removed nodes\| > 0` | Node add/remove — quality audit failed local path |
| `\|added\| + \|removed\| > 10` | Bulk / import |
| `\|active\| / n > 20%` | Neighborhood covers too much graph |

### 4. Expected gain @ 1000 notes?

For **single link add** (dominant wiki-link edit path): **99.6% pair-iteration reduction**, 76 ticks unchanged, max active displacement **14.3px**.

Node create/delete still use warm-full path (76 ticks, full pairs) — layout quality preserved.

Conservative blended expectation for vaults where link edits dominate: **material frame-cost reduction on the most common topology edit** without risking note-add layout drift.

---

## Fallback Strategy

```text
resolveCosmosSimInitialAlpha()  → cold | warm
if warm && topology && !resize:
  plan = resolveCosmosLocalReheatPlan(...)
  if plan.mode == local_reheat → localActiveIds
  else → full graph (localActiveIds = null)
```

Universe galaxy cohesion runs only on active nodes during local reheat; fixed nodes retain settled positions. If future visual drift appears on galaxy-heavy edits, extend active set with galaxy mates (not implemented — documented risk).

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Boundary artifacts at active/fixed edge | Med | 2-hop expansion; quality audit gate |
| Hub-adjacent edit expands active set | Med | 20% / 200-node fallback to warm full |
| Bulk import layout quality | Low | Bulk node threshold → warm full |
| Galaxy cohesion drift | Low–Med | Fallback + monitor; optional galaxy extension later |
| Tick count unchanged | Info | Expected; cost savings are per-tick |

**Not in scope:** Barnes-Hut, workers, global force constant changes, K-92B2C render throttling.

---

## Verification

```bash
cd frontend
npm run typecheck
npm test
npm run build
npm test -- k92b2bIncremental
npm test -- cosmosLocalReheat
```

---

## Decision

Audit quality gate **passes for edge-only changes at 2-hop** @ 1000 notes (14.3px max displacement, 99.6% pair-cost drop). **Node add/remove fail quality gate** → production restricts local reheat to **edge-only topology deltas** with automatic warm-full fallback otherwise.

Implementation proceeded (not audit-only) with this conservative scope boundary.
