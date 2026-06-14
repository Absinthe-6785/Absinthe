# K-43 Product Hardening & Real-World Validation

**Branch:** `k43-product-hardening`

---

## Goal

K-33 through K-42 established Cosmos, intelligence, actions, discovery, and timeline. K-43 verifies the product works coherently for real users and vaults — without adding major features.

Focus: consistency, discoverability, usability, performance, information density.

---

## Scope

| Task | Priority | Outcome |
|------|----------|---------|
| A — Product surface audit | P0 | Documented in this file + per-area docs |
| B — Discoverability review | P0 | `K-43-discoverability-audit.md` + low-risk UI fixes |
| C — Context panel consistency | P0 | `K-43-context-panel-audit.md` + subtitle/empty states |
| D — Search experience | P1 | `K-43-search-review.md` |
| E — Dashboard rationalization | P1 | Documented hierarchy in search/dashboard docs |
| F — Real vault validation | P1 | `K-43-real-vault-validation.md` |
| G — Performance audit | P1 | `K-43-performance-audit.md` + safe memo reuse |
| H — Design language | P1 | `K-43-design-language-review.md` |

---

## Product Surface Summary (Task A)

| Surface | Purpose | Primary action | Secondary action | Entry | Exit |
|---------|---------|----------------|------------------|-------|------|
| **Notes** | Write and organize knowledge | Edit note | Search, star, export | Sidebar Notes | Other tabs, Cosmos |
| **Links** | Structure + connections for active note | Navigate backlink | Create relation, link source | Context panel Links tab | Navigate to note |
| **Cosmos (local)** | Neighborhood graph for active note | Expand nodes | Open full Cosmos | Context panel Cosmos tab, context strip | Full Cosmos |
| **Cosmos (full)** | Spatial vault overview | Select node | HUD: Discover, Timeline, Actions | Ctrl+G, header, dashboard | Select note → edit |
| **Insights** | Explain note importance & opportunities | Open suggested note | Open Links | Context panel | Navigate away |
| **Actions** | Executable cosmos recommendations | Connect, assign area | View candidates → Links | Context panel, HUD weak areas | Action completes |
| **Discover** | Vault-wide discovery feed | Revisit / open / create hub | Why-this blocks | Tab, dashboard card, HUD | Navigate to note |
| **Timeline** | Vault growth over time | Change period mode | Metric explain | Tab, dashboard card, HUD | Read-only (no drill-through) |
| **Planner** | Schedule + lightweight notes | Create event note | Open note in Notes | Sidebar Planner | `openNote()` → Notes |
| **Archive** | Marks, milestones, areas history | Open source note | Trace lenses → Notes | Sidebar Archive | Notes trace views |
| **Dashboard** | Workspace overview + Cosmos entry | Open note / Cosmos / Discover | Product tour, review | Sidebar Dashboard | Leave dashboard |
| **Search** | Find notes, projects, paths | Open result | Filter by kind | Ctrl+K, sidebar filter, Ctrl+F | Close / clear |

---

## Cross-Surface Friction (Top Issues)

1. **Dual Cosmos** — context strip opens local graph; header Ctrl+G opens full graph (same “Cosmos” label).
2. **Insights ↔ Actions overlap** — suggested connections and opportunities appear in both panels.
3. **Archive Timeline vs Knowledge Timeline** — same word, different meaning (marks history vs vault growth).
4. **Discover/Timeline without note** — panel visible; other tabs were blank until K-43 empty state.
5. **Planner isolation** — no Links, Insights, Actions, Discover, Timeline in Planner embed.
6. **Three search modes** — sidebar filter, Ctrl+K workspace search, Ctrl+F document search.
7. **Hardcoded Korean** — sidebar “노트”, dashboard label (fixed in K-43).

---

## K-43 Code Changes (Low-Risk)

| Change | File(s) |
|--------|---------|
| Context panel subtitle includes Timeline | `i18n.ts` |
| Empty state when note-required tab without note | `NoteView.tsx` |
| Timeline tab tooltip disambiguation | `KnowledgeContextPanel.tsx`, `NoteView.tsx` |
| i18n for sidebar Notes + Dashboard labels | `NoteView.tsx`, `i18n.ts` |
| Reuse `discoveryFeed` in dashboard + search | `NoteView.tsx`, `buildUnifiedWorkspaceDashboard.ts`, `WorkspaceSearchPalette.tsx` |
| Hoist `buildNoteGalaxyMap` per search query | `buildWorkspaceSearch.ts` |
| Dedupe `buildAreaEvolution` in timeline | `knowledgeTimeline.ts` |
| Localize empty Cosmos unlinked copy | `i18n.ts` |

---

## Constraints (unchanged)

- No AI, embeddings, renderer redesign, Planner/Archive redesign, or new major systems.

---

## Verification

```bash
npm run typecheck
npm run build
npm run test
```

See `K-43-validation-checklist.md`.
