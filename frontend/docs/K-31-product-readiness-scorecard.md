# K-31 — Product Readiness Scorecard

**Branch:** `k31-release-candidate`  
**Scope:** Consolidated K-31 Pass 1–5 + K-31.1 + K-31.2 + K-31.3 RC stabilization

---

## Scores

| Area | K-31.2 | RC (K-31.3) | Rationale | Blockers |
| ---- | ------ | ----------- | --------- | -------- |
| **Navigation** | 8.5 | **8.5** | Live-block TOC (K-31.1) + archive tabs | URL sync for archive modes |
| **Discoverability** | 7.5 | **7.5** | Archive tabs surface branches | Legacy planner mini-calendar |
| **Localization** | 8.5 | **8.5** | Archive/Planner P0 + untitled note locale | NoteView legacy KO |
| **Planner** | 7 | **7** | Calendar + timetable localized | Duplicate mobile calendar |
| **Archive** | 8.5 | **8.5** | Full branch navigation wired | URL deep-links |
| **Workspace** | 7.5 | **7.5** | Search + database i18n | NoteView chrome i18n |
| **Graph** | 7 | 7 | Scale policy wired | Toolbar KO strings; 500+ perf |
| **Accessibility** | 7.5 | **7.5** | TOC keyboard + archive tablist | Global TOC shortcut |
| **Visual Consistency** | 7.5 | 7.5 | Sidebar stroke aligned | NoteView inline styles |
| **Mobile Experience** | 6.5 | 6.5 | Protein tab fixed | Dual planner nav |

---

## Overall Readiness

**7.9 / 10** — Release candidate for K-31 scope

Consolidation complete; automated suite green (1748 tests). Remaining blockers are documented and deferred to K-32 (NoteView i18n, planner consolidation).

---

## K-31.3 RC Deliverables

- ✅ Branch `k31-release-candidate` (main + stabilization + outline rewrite + reality pass)
- ✅ Merge conflicts: **none**
- ✅ RC regression fix: locale-aware untitled note labels + TOC untitled placeholder
- ✅ Audit docs: localization, archive, planner, graph, validation checklist
- ✅ `npm run typecheck` / `build` / `test` pass

---

## Outline Navigation (verified in code + tests)

| Capability | Status | Evidence |
| ---------- | ------ | -------- |
| TOC click | ✅ | `navigateToHeading` + live `blocks` |
| TOC Enter | ✅ | `tocKeyboardNavigation.ts` |
| TOC j/k | ✅ | `NoteView` `handleTocKeyDown` |
| Scroll spy | ✅ | `useTocScrollSpy` + `getOutlineBlocks()` |
| Virtualized editor | ✅ | `outlineNavigation.integration.test.ts` |
| Reading mode | ✅ | Integration test readOnly path |
| Toggle headings | ✅ | `includeNested` + depth-first resolution |

**No outline regressions** reintroduced on RC (K-31.1 rewrite preserved).

---

## Top Remaining Blockers (post-RC)

1. NoteView full localization
2. Planner legacy mini-calendar removal
3. Graph toolbar i18n + 500+ node performance
4. Archive mode URL sync

---

## Recommended Next Milestone

**K-32** — NoteView i18n + planner consolidation (target Localization ≥ 9, Planner ≥ 7.5)
