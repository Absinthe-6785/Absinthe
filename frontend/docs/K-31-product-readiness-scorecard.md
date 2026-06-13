# K-31 — Product Readiness Scorecard

**Branch:** `k31-product-stabilization`  
**Scope:** Phase 5 — 0–10 scoring

Scoring reflects post-K-31 fixes on top of K-30.56 baseline.

---

## Scores

| Area | Score | Rationale | Blockers |
| ---- | ----- | --------- | -------- |
| **Navigation** | 7 | Outline TOC scroll fixed for virtualization; Archive tab label corrected | Archive→Note tab switch; browse links |
| **Discoverability** | 6 | Sidebar IA clearer; graph/timetable still below fold | Hidden weekly timetable; dual planner nav |
| **Localization** | 6 | Planner calendar headers + Archive tab; default lang still `en` | Workspace panels; archive period labels |
| **Planner** | 6 | Four calendar modes solid; legacy duplication remains | Timeline vs Day CRUD split |
| **Archive** | 4 | Beautiful shell, sparse interactions | Heatmap/browse not wired |
| **Workspace** | 7 | Smart collections grouped (K-30.49); search polished | English section titles |
| **Graph** | 5 | Local panel useful; full graph raw | Overlap, no type styling |
| **Accessibility** | 6.5 | K-30.56 modal/skip baseline | TOC keyboard; archive grid |
| **Visual Consistency** | 6 | Planner/Archive cohesive; NoteView dialect separate | Inline styles in NoteView |
| **Mobile Experience** | 6 | Drawers + touch targets OK | Dual planner tabs; small heatmap cells |

---

## Overall Readiness

**6.1 / 10** — Stabilization fixes remove P0 regressions (outline nav, misleading Analytics label) and close obvious i18n gaps. Product still feels like a mature editor + beta archive/planner fusion.

---

## K-31 Deliverables Completed

- ✅ Task A: Outline navigation + virtualization + scroll-spy hybrid + tests
- ✅ Task B: Sidebar Archive label + icon
- ✅ Task C: Localization fixes + audit doc
- ✅ Tasks D–J: Audit documents
- ✅ This scorecard

---

## Recommended Next Milestone (K-31.1 or K-32)

1. **Archive activation** — wire heatmap/browse → filtered views; switch tab on note open.
2. **Planner consolidation** — demote legacy column; Day view schedule CRUD.
3. **i18n completion** — NoteView panels + workspace; default language policy (ko for KR users?).
4. **Graph quick wins** — hub sizing, label threshold, type colors.
5. **TOC keyboard** — j/k section navigation.

---

## Regression Watchlist

- Outline scroll-spy with edited documents (cache invalidation on body string reuse).
- Virtual list remeasure after toggle collapse changing heading positions.
- Sidebar tab id remains `analytics` internally — tests/docs should reference Archive label.
