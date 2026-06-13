# K-31 — Graph Readability Pass 2 Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P1 — pass 4  
**Prior score:** 6 / 10

---

## Pass 2 Baseline

- Labels on hover / active / search match only
- SVG `<title>` tooltips
- Folder color dots

---

## Pass 4 Quick Wins

| Improvement | Behavior |
| ----------- | -------- |
| **Focus neighborhood** | Hover or selection dims unrelated nodes/edges; 1-hop cluster stays visible |
| **Hub visibility** | Nodes with ≥4 links: larger radius + dashed outer ring; hub label on hover status |
| **Selection ring** | Active node gets persistent outer accent ring |
| **Hover glow** | Slightly larger glow radius |
| **Edge emphasis** | Edges touching hovered node get thicker stroke |
| **Hub labels** | Hub nodes show labels when in focus cluster |

Architecture unchanged — same force layout, same data pipeline.

---

## Remaining Gaps

| Gap | Priority |
| --- | -------- |
| Counter bar i18n (“notes · links”) | P2 |
| Layout engine (overlap at scale) | P3 |
| Minimap / cluster collapse | Out of scope |

---

## Score Impact

**Graph: 6 → 6.5** — neighborhood focus and hub hierarchy improve scanability without layout rewrite.

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Quick wins only | Met |
| No architecture change | Met |
| Hub/hover/selection improved | Met |
