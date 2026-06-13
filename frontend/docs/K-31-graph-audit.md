# K-31 — Graph Experience Audit

**Branch:** `k31-product-stabilization`  
**Scope:** Task F — document only (no redesign)

**Reference products:** Obsidian, Logseq, Capacities

---

## Current State

- **Full-screen:** `NoteGraphView` — force-directed SVG, node circles + truncated labels (~16 chars).
- **Panel:** `LocalGraphView` — ego network in NoteView right panel; selection strip + hover preview (K-30.41).
- **No** unified knowledge-map canvas (K-30.42 explicitly deferred).

---

## Issues Observed

| Issue | Severity | Detail |
| ----- | -------- | ------ |
| Label overlap | High | No collision avoidance; truncation only |
| Visual clutter | High | Uniform node size; dense notes → hairball |
| Weak hierarchy | Medium | Hubs not visually dominant vs leaf notes |
| Discoverability | Medium | Graph mode tab hidden in reading/edit chrome |
| Raw node feel | Medium | Circles + text; no type encoding (area, source, concept) |

---

## Comparison Snapshot

| Capability | Obsidian | Logseq | Capacities | Absinthe |
| ---------- | -------- | ------ | ---------- | -------- |
| Local graph | Yes | Yes | Yes | Panel + full |
| Global graph | Yes | Limited | Yes | Full screen only |
| Label collision handling | Partial | Partial | Better spacing | None |
| Node type styling | By folder/tag | Page refs | Object types | Uniform |
| Click → open | Yes | Yes | Yes | Yes |
| Filter / depth control | Yes | Yes | Yes | Expand nodes only |

---

## Quick Wins (stabilization-safe)

1. Increase label offset from node center; hide labels below zoom threshold.
2. Scale node radius by link degree (hub emphasis).
3. Color nodes by folder or `area` property when present.
4. Empty-state hint in graph panel: “Double-click to open · Scroll to zoom”.
5. Korean empty/error copy in full-screen graph (P2 i18n).

---

## Medium Improvements (next milestone)

1. Mini-map or depth slider (1-hop / 2-hop / cluster).
2. Search/filter nodes in graph view.
3. Edge bundling or curved links to reduce overlap.
4. Touch: single-tap preview, double-tap open (K-30.41 backlog).

---

## Long-Term Direction

1. **Typed graph layer** — concepts, sources, projects as distinct shapes (Capacities-style).
2. **Unified map shell** — one canvas embeddable in Archive + NoteView (K-30.42 roadmap).
3. **Layout modes** — hierarchical (tree), radial (ego), temporal (review queue).
4. **Performance** — WebGL or canvas fallback for >200 nodes; keep SVG for local graph.

---

## Out of Scope (K-31)

- New graph engine.
- Full-screen redesign.
