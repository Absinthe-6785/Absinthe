# K-31 — Graph Scale Audit (Pass 5)

**Branch:** `k31-product-stabilization`  
**Scope:** 100+ / 250+ / 500+ node scenarios (P1, low-risk fixes only)

---

## Scenarios Reviewed

| Tier | Nodes | Risk |
| ---- | ----- | ---- |
| normal | &lt; 100 | Baseline — hub labels visible |
| large | 100–249 | Ambient label noise |
| xlarge | 250+ | Simulation cost + label clutter |

---

## Policy (`graphScalePolicy.ts`)

| Knob | normal | large (≥100) | xlarge (≥250) |
| ---- | ------ | ------------ | ------------- |
| Ambient labels | Hubs + focus cluster | Hubs in focus cluster only | Hubs in focus cluster only |
| Search filter active | Labels suppressed except match/hover/active | same | same |
| Repulsion | 3200 | 2600 | 1800 |
| Alpha floor | 0.005 | 0.005 | 0.02 (faster settle) |

Always show labels for: active node, hover, search match.

---

## Wired In

- `NoteGraphView.tsx` — `shouldShowGraphNodeLabel`, `graphRepulsionStrength`, `graphSimulationAlphaFloor`

---

## Not Changed (Deferred)

- Layout engine replacement (force-directed loop unchanged structurally)
- Graph toolbar counter i18n
- WebGL / clustering at 500+

---

## Tests

- `graphScalePolicy.test.ts` — tier classification, label suppression at 120 nodes, active/hover override

---

## Status

**Done** — low-risk density and simulation tuning for large graphs.
