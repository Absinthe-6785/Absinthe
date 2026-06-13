# K-31 — Product Readiness Scorecard

**Branch:** `k31-product-stabilization`  
**Scope:** Phase 5 — 0–10 scoring (updated after pass 3)

---

## Scores

| Area | Pass 1 | Pass 2 | Pass 3 | Rationale | Blockers |
| ---- | ------ | ------ | ------ | --------- | -------- |
| **Navigation** | 7 | 7.5 | **7.5** | Unchanged — outline/backspace fixed pass 1–2 | Archive period branches |
| **Discoverability** | 6 | 6 | **6.5** | Archive section empty CTAs + mark calendar click hint | Weekly timetable below fold |
| **Localization** | 6 | 6.5 | **7.5** | Default `ko`, Database/Properties/Tags i18n, `resolveAppLanguage` | Graph counters, Luxon locale |
| **Planner** | 6 | 6 | 6 | Calendar headers i18n (pass 1) | Legacy column duplication |
| **Archive** | 4 | 5.5 | **6.5** | All home sections actionable empty states | Period/area/timeline shells |
| **Workspace** | 7 | 7 | **7.5** | Localized database view subtitles | Section title i18n |
| **Graph** | 5 | 6 | 6 | Pass 2 hover labels | Layout engine unchanged |
| **Accessibility** | 6.5 | 6.5 | 6.5 | Unchanged | TOC keyboard |
| **Visual Consistency** | 6 | 6.5 | **7** | Icon stroke alignment, Archive scroll | NoteView inline styles |
| **Mobile Experience** | 6 | 6 | 6 | Unchanged | Dual planner nav |

---

## Overall Readiness

**6.1 → 6.4 → 6.8 / 10**

Pass 3 closes the English-first gap (default locale + Database/Properties batch) and makes Archive home sections actionable without redesign.

---

## Pass 3 Deliverables

- ✅ Default language strategy (`ko` default, `resolveAppLanguage`) + audit
- ✅ Database & properties localization + audit
- ✅ Archive pass 2 (empty CTAs, hints, scroll) + audit
- ✅ Visual identity pass + audit
- ✅ Icon system pass 2 doc + sidebar stroke alignment
- ✅ Terminology audit
- ✅ Scorecard update

---

## Remaining Blockers (Product Ready)

1. Archive Period / Area / Timeline branch implementations
2. Luxon / projection locale wiring for Archive
3. Planner legacy column demotion
4. TOC keyboard navigation (j/k)
5. Graph layout engine + counter i18n

---

## Regression Watchlist

- Persisted `language: 'en'` users unchanged; new installs default `ko`
- Database UX tests mock `useAppStore` for English switcher assertions
- Archive empty CTAs call `switchToNotesTab()` — verify cross-tab navigation in manual QA
