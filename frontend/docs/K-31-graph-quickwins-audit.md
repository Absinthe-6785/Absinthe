# K-31 — Graph Quick Wins Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P1 — low-risk improvements only (no redesign)

**Prior score:** 5/10 → **Target:** 6/10

---

## Issues (unchanged architecture)

| Issue | Severity |
| ----- | -------- |
| Label overlap | High |
| Uniform node sizing | Medium |
| Weak active/hover signal | Medium |
| Undiscoverable zoom/pan | Low |

---

## Implemented Quick Wins

| Win | Change |
| --- | ------ |
| Label clutter | Show labels only for **active**, **hovered**, or **search-matched** nodes |
| Hover discoverability | SVG `<title>` with full note title on every node |
| Selection visibility | Active/hover/match stroke width 2 → 2.5px |
| Label offset | `r + 14` → `r + 16` px below node |
| Status hint | `hover=제목` in graph status bar |

**Not changed:** force layout engine, global graph canvas, node type encoding, WebGL.

---

## Deferred (medium / long-term)

- Hub radius by link degree (partially exists via `links` count)
- Hide labels below zoom threshold (`transform.k`)
- Local graph panel parity
- Typed node shapes

---

## Comparison Note

Obsidian/Logseq hide labels until hover by default — K-31 aligns full-screen graph with that pattern.

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| No engine redesign | Met |
| Reduced overlap | Met |
| Improved hover/readability | Met |
