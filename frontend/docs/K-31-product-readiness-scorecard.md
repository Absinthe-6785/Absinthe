# K-31 — Product Readiness Scorecard

**Branch:** `k31-product-reality-pass`  
**Scope:** Phase 5 — 0–10 scoring (updated after K-31.2 Product Reality Pass)

---

## Scores

| Area | Pass 4 | Pass 5 | K-31.2 | Rationale | Blockers |
| ---- | ------ | ------ | ------ | --------- | -------- |
| **Navigation** | 8 | **8.5** | **8.5** | TOC live-block nav (K-31.1) + archive tabs | URL sync for archive modes |
| **Discoverability** | 7 | **7.5** | **7.5** | Archive tabs surface all branches | Legacy planner column |
| **Localization** | 7.5 | **8** | **8.5** | Archive + Planner P0 strings wired to i18n | NoteView legacy KO |
| **Planner** | 6.5 | 6.5 | **7** | Calendar modes + weekly timetable localized | Legacy column duplication |
| **Archive** | **7.5** | **8** | **8.5** | UI copy follows app language | Browse link projection locale |
| **Workspace** | 7.5 | 7.5 | 7.5 | Unchanged | NoteView section title i18n |
| **Graph** | 6.5 | **7** | 7 | Scale-aware labels | Toolbar counter i18n |
| **Accessibility** | 6.5 | **7.5** | **7.5** | TOC keyboard + archive tablist | Global TOC shortcut |
| **Visual Consistency** | 7.5 | 7.5 | **7.5** | Sidebar stroke aligned | NoteView inline styles |
| **Mobile Experience** | 6.5 | 6.5 | **6.5** | Protein tab label fixed | Dual planner nav |

---

## Overall Readiness

**7.2 → 7.6 → 7.9 / 10**

K-31.2 closes P0 localization gaps on Archive Home and Planner surfaces, verifies Protein Tracker implementation, and documents remaining legacy debt without scope creep.

---

## K-31.2 Deliverables

- ✅ Language system audit + Archive/Planner fixes
- ✅ Protein Tracker verification (mobile tab label)
- ✅ Sidebar / icon consistency audit
- ✅ Theme consistency audit (documented outliers)
- ✅ Planner reality audit + recommendations
- ✅ `K-31.2-product-reality-audit.md`
- ✅ Scorecard update

---

## Top Remaining Blockers

1. NoteView full localization (`NoteView.tsx` legacy inline KO)
2. Planner legacy timeline column / mobile mini-calendar removal
3. Graph layout engine at 500+ nodes (performance ceiling)
4. Archive browse projection link labels vs UI locale
5. Archive mode ↔ URL / sidebar sync

---

## Recommended Next Major Milestone

**K-32 Planner consolidation + NoteView i18n** — remove duplicate legacy column, unify mobile planner IA, sweep NoteView strings (target Localization ≥ 9, Planner ≥ 7.5).

---

## Deferred Improvements

- Global TOC shortcuts without focusing listbox
- Graph clustering / WebGL for very large vaults
- Archive deep-link routing for Period/Area/Timeline tabs
- Database weekday header localization
- Graph toolbar counter i18n

---

## Regression Watchlist

- Archive projection `frame.title` still locale-derived for hook consumers — UI uses `t()` directly
- English setting must show zero Korean on Archive Home / Planner headers (regression test coverage added)
- Protein mobile tab must match desktop label key `proteinTracker`
