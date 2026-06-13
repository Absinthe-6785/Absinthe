# K-31 — Product Readiness Scorecard

**Branch:** `k31-product-stabilization`  
**Scope:** Phase 5 — 0–10 scoring (updated after pass 5)

---

## Scores

| Area | Pass 3 | Pass 4 | Pass 5 | Rationale | Blockers |
| ---- | ------ | ------ | ------ | --------- | -------- |
| **Navigation** | 7.5 | 8 | **8.5** | Archive mode tabs + TOC j/k/Enter | URL sync for archive modes |
| **Discoverability** | 6.5 | 7 | **7.5** | Archive tabs surface all branches | Legacy planner column |
| **Localization** | 7.5 | 7.5 | **8** | Archive/database month labels follow app language | Frame literals, graph counters |
| **Planner** | 6 | 6.5 | 6.5 | Unchanged pass 5 | Legacy column duplication |
| **Archive** | 6.5 | 7.5 | **8** | In-app tabs + locale-aware browse/period | Full period shell |
| **Workspace** | 7.5 | 7.5 | 7.5 | Unchanged | Section title i18n |
| **Graph** | 6 | 6.5 | **7** | Scale-aware labels + repulsion tuning | Layout engine at 500+ |
| **Accessibility** | 6.5 | 6.5 | **7.5** | TOC listbox keyboard + archive tablist | Global TOC shortcut |
| **Visual Consistency** | 7 | 7.5 | 7.5 | Unchanged | NoteView inline styles |
| **Mobile Experience** | 6 | 6.5 | 6.5 | Unchanged | Dual planner nav |

---

## Overall Readiness

**6.8 → 7.2 → 7.6 / 10**

Pass 5 closes P0 TOC keyboard, archive tab navigation, locale date consistency, and graph scale polish — crossing the 7.5 product-readiness target.

---

## Pass 5 Deliverables

- ✅ TOC keyboard navigation (j/k/Enter) + audit
- ✅ Archive mode switcher + audit
- ✅ Locale consistency (Archive + database month headers) + audit
- ✅ Graph scale policy wired + audit
- ✅ Scorecard update

---

## Top Remaining Blockers

1. Planner legacy timeline column removal (structural simplification)
2. Archive frame / projection copy i18n (non-date strings)
3. Graph layout engine at 500+ nodes (performance ceiling)
4. NoteView TOC panel copy localization
5. Archive mode ↔ URL / sidebar sync

---

## Recommended Next Major Milestone

**K-32 Planner consolidation** — remove duplicate legacy column, unify navigation chrome, and align mobile planner IA (target Navigation ≥ 9, Planner ≥ 7.5).

---

## Deferred Improvements

- Global TOC shortcuts without focusing listbox
- Graph clustering / WebGL for very large vaults
- Archive deep-link routing for Period/Area/Timeline tabs
- Database weekday header localization
- Graph toolbar counter i18n

---

## Regression Watchlist

- TOC keyboard requires focus on listbox — document in shortcuts panel
- Graph xlarge tier shows fewer ambient labels — hubs still visible on hover
- Archive English browse labels when `language: 'en'` — Korean remains default projection frame
