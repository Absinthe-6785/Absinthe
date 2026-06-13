# K-31 — Product Readiness Scorecard

**Branch:** `k31-product-stabilization`  
**Scope:** Phase 5 — 0–10 scoring (updated after pass 4)

---

## Scores

| Area | Pass 2 | Pass 3 | Pass 4 | Rationale | Blockers |
| ---- | ------ | ------ | ------ | --------- | -------- |
| **Navigation** | 7.5 | 7.5 | **8** | Archive branches route to trace/notes | In-app archive tab switcher |
| **Discoverability** | 6 | 6.5 | **7** | Branch views + collapsed weekly timetable | Legacy planner column |
| **Localization** | 6.5 | 7.5 | 7.5 | Unchanged pass 4 | Graph counters, Luxon locale |
| **Planner** | 6 | 6 | **6.5** | Weekly timetable demoted (collapsed default) | Legacy column duplication |
| **Archive** | 5.5 | 6.5 | **7.5** | Branch views replace dead-end placeholders | Full period shell |
| **Workspace** | 7 | 7.5 | 7.5 | Unchanged | Section title i18n |
| **Graph** | 6 | 6 | **6.5** | Focus neighborhood + hub styling | Layout engine |
| **Accessibility** | 6.5 | 6.5 | **6.5** | Timetable toggle `aria-expanded` | TOC keyboard |
| **Visual Consistency** | 6.5 | 7 | **7.5** | Planner/Archive icon rhythm aligned | NoteView inline styles |
| **Mobile Experience** | 6 | 6 | **6.5** | Collapsed timetable reduces scroll | Dual planner nav |

---

## Overall Readiness

**6.4 → 6.8 → 7.2 / 10**

Pass 4 targets Archive branch usefulness, planner noise reduction, and graph scanability — moving overall readiness above 7.0.

---

## Pass 4 Deliverables

- ✅ Archive branch views (`ArchiveBranchView`) + pass 3 audit
- ✅ Planner simplification (collapsible weekly timetable) + audit
- ✅ Graph readability pass 2 + audit
- ✅ Visual identity pass 2 + audit
- ✅ Scorecard update

---

## Remaining Blockers (Product Ready)

1. Archive in-app mode tabs (Home / Period / Area / Timeline)
2. Luxon locale for Archive period labels
3. Planner legacy timeline column removal
4. Graph counter i18n + layout at scale
5. TOC keyboard navigation (j/k)

---

## Regression Watchlist

- Archive branch views require `useArchiveHomeProjection` — same data as Home
- Weekly timetable collapsed when empty — users with existing blocks auto-expand
- Graph focus-dim on hover may feel aggressive — adjust opacity if feedback says so
