# K-31 — Product Readiness Scorecard

**Branch:** `k31-product-stabilization`  
**Scope:** Phase 5 — 0–10 scoring (updated after pass 2)

---

## Scores

| Area | Pass 1 | Pass 2 | Rationale | Blockers |
| ---- | ------ | ------ | --------- | -------- |
| **Navigation** | 7 | **7.5** | Outline virtualization fixed; backspace focus chain fixed | Archive period branches |
| **Discoverability** | 6 | 6 | Archive CTA; graph hover labels | Weekly timetable below fold |
| **Localization** | 6 | **6.5** | Archive placeholders + empty CTA i18n | Database panel English |
| **Planner** | 6 | 6 | Calendar headers i18n (pass 1) | Legacy column duplication |
| **Archive** | 4 | **5.5** | Empty CTA, placeholder guidance, tab rename | Period/area/timeline shells |
| **Workspace** | 7 | 7 | Unchanged | Section title i18n |
| **Graph** | 5 | **6** | Label-on-hover, title tooltip, stroke polish | Layout engine unchanged |
| **Accessibility** | 6.5 | 6.5 | Graph `<title>` tooltips help SR hover | TOC keyboard |
| **Visual Consistency** | 6 | **6.5** | Archive + graph hierarchy tweaks | NoteView inline styles |
| **Mobile Experience** | 6 | 6 | Unchanged | Dual planner nav |

---

## Overall Readiness

**6.1 / 10 → 6.4 / 10**

Stabilization pass 2 closes a critical editor regression (backspace focus) and raises Archive/Graph from “visual-only” toward actionable surfaces.

---

## K-31 Pass 2 Deliverables

- ✅ Backspace navigation fix + tests + audit
- ✅ Archive recovery (empty CTA, placeholder i18n) + audit
- ✅ Graph quick wins + audit
- ✅ Localization pass 2 + audit
- ✅ Visual consistency pass + audit
- ✅ Scorecard update

---

## Recommended Next Milestone

1. Archive Period branch → trace range view
2. Database/properties panel i18n batch
3. Planner legacy column demotion
4. Default locale policy (ko for primary market)
5. TOC keyboard navigation (j/k)

---

## Regression Watchlist

- Backspace on empty **first** root block (merge no-op at pos 0)
- Delete key on empty block still uses delete path — focus restore verified via `resolveFocusAfterBlockDelete`
- Graph labels hidden until hover — users must discover via status hint
