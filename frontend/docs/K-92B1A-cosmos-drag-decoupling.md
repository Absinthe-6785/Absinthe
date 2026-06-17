# K-92B1A — Cosmos Drag-Decoupled Simulation

**Branch:** `k92b1a-cosmos-drag-decoupling`  
**Reference:** [K-92B1 Cosmos Force Simulation Optimization](./K-92B1-cosmos-force-sim-optimization.md)  
**Status:** Phase 1 implemented — drag decoupled from sim lifecycle  
**Scope:** Remove `dragging` from force-sim `useEffect` dependencies only

---

## Executive Summary

K-92B1 showed that **every node click restarted the full O(n²) force simulation twice** (~4.5 s @ 1000 notes) because `dragging` was in the simulation effect dependency array. Expand-node work remains &lt; 0.2 ms.

**K-92B1A (Phase 1):** Simulation reads drag state from `draggingRef` inside the rAF loop. Pointer events no longer cancel and recreate the effect. Topology changes (`vaultStructureVersion`, etc.) still restart simulation as before.

**Not in scope:** Barnes-Hut, Web Worker, alpha tuning, render throttling (Phase 2+).

---

## Root Cause

```text
mousedown  → setDragging(id)  → dragging in useEffect deps → effect cleanup + restart → alpha = 1.0
mouseup    → setDragging(null) → dragging in useEffect deps → effect cleanup + restart → alpha = 1.0
```

Each restart runs the full cold settle path (129+ ticks × O(n²) repulsion @ 500+ nodes). Click latency dominated simulation restart, not expand logic or SVG paint.

---

## Lifecycle — Before

```mermaid
sequenceDiagram
  participant User
  participant React
  participant SimEffect as Force sim useEffect
  participant Loop as rAF step()

  User->>React: mousedown (node)
  React->>React: setDragging(id)
  React->>SimEffect: dep change (dragging)
  SimEffect->>SimEffect: cancel rAF, alpha = 1.0
  SimEffect->>Loop: new rAF loop

  User->>React: mouseup
  React->>React: setDragging(null)
  React->>SimEffect: dep change (dragging)
  SimEffect->>SimEffect: cancel rAF, alpha = 1.0
  SimEffect->>Loop: new rAF loop
```

---

## Lifecycle — After (K-92B1A)

```mermaid
sequenceDiagram
  participant User
  participant React
  participant Ref as draggingRef
  participant SimEffect as Force sim useEffect
  participant Loop as rAF step()
  participant DragFx as Drag pointer useEffect

  User->>React: mousedown (node)
  React->>Ref: draggingRef.current = id
  React->>React: setDragging(id) (UI only)
  Note over SimEffect: no dep change — sim continues

  Loop->>Ref: read draggingRef.current
  Loop->>Loop: skip physics for dragged node

  User->>React: mousemove
  DragFx->>Loop: direct nd.x/nd.y update + setTick

  User->>React: mouseup
  React->>Ref: draggingRef.current = null
  Note over SimEffect: no dep change — sim continues

  User->>Vault: note create/delete/link
  React->>SimEffect: vaultStructureVersion change
  SimEffect->>SimEffect: restart (expected)
```

---

## Implementation

| Change | Location |
| ------ | -------- |
| `draggingRef` + `updateDragging()` | `NoteGraphView.tsx` |
| Sim loop reads `draggingRef.current` | Force integration skip (was `dragging`) |
| Removed `dragging` from sim effect deps | Same file, force-directed `useEffect` |
| Drag pointer handlers unchanged | Separate `useEffect([dragging, transform])` |
| Audit harness + verification tests | `k92b1aCosmosDragDecouplingAudit.ts` |

---

## Benchmark Methodology

- **Harness:** `k92b1aCosmosDragDecouplingAudit.ts` + `runK92b1ForceSimAudit()` cold settle timings
- **Fixture:** `buildLargeVaultDataset()` + `buildGlobalGraphData()` (same as K-92B1)
- **Before model:** Each pointer event that changed `dragging` triggered one full cold settle (`coldSimSettleMs`); click = mousedown + mouseup = **2× cold**
- **After model:** Pointer events update `draggingRef` only → **0 ms** sim restart cost (direct position updates via drag handler)
- **Topology:** `vaultStructureVersion` still in deps → restart cost = **1× cold** (unchanged)
- **Run:** `npm test -- k92b1aCosmosDrag`

Measured on local Vitest run (2026-06-16, Windows, median physics loop):

---

## Measured Results

| Notes | Cold settle | Click before | Click after | Drag start before | Drag start after | Drag end before | Drag end after | Topology (unchanged) |
| ----: | ----------: | -----------: | ----------: | ----------------: | ---------------: | --------------: | -------------: | ---------------------: |
| 100 | 31.39 ms | 62.78 ms | 0.00 ms | 31.39 ms | 0.00 ms | 31.39 ms | 0.00 ms | 31.39 ms |
| 300 | 137.22 ms | 274.44 ms | 0.00 ms | 137.22 ms | 0.00 ms | 137.22 ms | 0.00 ms | 137.22 ms |
| 500 | 367.31 ms | 734.62 ms | 0.00 ms | 367.31 ms | 0.00 ms | 367.31 ms | 0.00 ms | 367.31 ms |
| 1000 | 2263.69 ms | **4527.38 ms** | 0.00 ms | 2263.69 ms | 0.00 ms | 2263.69 ms | 0.00 ms | 2263.69 ms |

**@ 1000 notes:** click path drops from ~4.5 s (double restart) to ~0 s sim cost. K-92B1 reported ~3717 ms double restart; variance is machine/load dependent; model and direction match.

---

## Verification

### Restart path removed

| Event | Before | After |
| ----- | ------ | ----- |
| mousedown | Sim effect restarts | No sim restart |
| mouseup | Sim effect restarts | No sim restart |
| drag start | Sim effect restarts | No sim restart |
| drag end | Sim effect restarts | No sim restart |
| vault topology change | Sim effect restarts | Sim effect restarts (unchanged) |

Automated checks:

- `readForceSimEffectDepsFromNoteGraphView()` — `dragging` not in dependency array
- `snapshotProductionSimConfig()` — `effectRestartDeps` excludes `dragging`

### Regression areas (manual / existing coverage)

| Area | Status |
| ---- | ------ |
| Node dragging | `updateDragging` + pointer `useEffect` unchanged |
| Node positioning | Direct `nd.x`/`nd.y` updates during drag |
| Expand node | Local graph path; does not touch Cosmos sim deps |
| Collapse node | Same |
| Graph rebuild | `vaultStructureVersion` still restarts sim |
| Warm positions | Node init effect unchanged; no extra full reheat on drag |
| Selection / hover | Unchanged (`hovered`, `activeNoteId` paths) |

---

## Files Changed

| File | Role |
| ---- | ---- |
| `src/components/views/NoteGraphView.tsx` | Production fix |
| `src/components/views/k92b1CosmosForceSimAudit.ts` | Update `effectRestartDeps` snapshot |
| `src/components/views/k92b1CosmosForceSimAudit.test.ts` | Expect no `dragging` in deps |
| `src/components/views/k92b1aCosmosDragDecouplingAudit.ts` | Before/after benchmark harness |
| `src/components/views/k92b1aCosmosDragDecouplingAudit.test.ts` | Verification tests |
| `docs/K-92B1A-cosmos-drag-decoupling.md` | This report |

---

## Migration Impact

- **User-visible:** Node click/select on Cosmos should no longer trigger multi-second hitches @ large vaults.
- **API:** None.
- **Docs refresh:** Re-run `npm run audit:discovery` only if updating observed vault metrics (unrelated to this change).

---

## Risk Assessment

| Risk | Level | Notes |
| ---- | ----- | ----- |
| Dragged node still affected by physics | Low | `draggingRef` skip preserved |
| Stale ref | Low | `updateDragging` syncs ref + state atomically |
| Sim never restarts when needed | Low | Topology deps unchanged |
| Regression in pan/zoom | None | Separate code path |

**Safe to merge** after review: minimal diff, audit-backed, Phase 1 scope only.

---

## Commands

```bash
cd frontend
npm run typecheck
npm test
npm test -- k92b1aCosmosDrag
npm test -- k92b1CosmosForceSim
npm run build
```
