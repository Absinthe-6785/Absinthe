# K-31 — Archive Recovery Pass 3 Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P0 — pass 4  
**Prior score:** 6.5 / 10

---

## Problem (Before Pass 4)

Period, Area, and Timeline branches rendered `ArchivePlaceholderView` — a dead-end message with no note access.

Browse links on Home already opened trace lenses, but branch routes did not reuse that wiring.

---

## Pass 4 Changes

| Branch | Surface | Navigation |
| ------ | ------- | ---------- |
| **Period** | Period browse links + mark calendar | `openArchiveBrowseDestination` → trace range; “Open current month” CTA |
| **Area** | Area pills (reuse home component) | Pill → `openNote`; “Browse all areas in trace” CTA |
| **Timeline** | Recent milestones + mark calendar | Milestone → note; “Open timeline range in trace” CTA |
| **All branches** | Empty archive CTA | `switchToNotesTab()` when projection empty |

New component: `ArchiveBranchView.tsx` — replaces placeholder in `ArchiveShell` for non-home modes.

Helper: `listArchivePeriodBrowseLinks()` filters period destinations from browse projection.

---

## Dead-End Reduction

| Before | After |
| ------ | ----- |
| Static “not available yet” copy | Actionable links + trace/note navigation |
| 0 note entry points on branch routes | 1-click trace range, note open, discovery |
| Browse only on Home | Period links duplicated on Period branch |

---

## Remaining Gaps

| Gap | Priority |
| --- | -------- |
| In-app tab switcher Home ↔ Period ↔ Area ↔ Timeline | P1 |
| Luxon locale for period labels | P2 |
| Full period shell (not trace redirect) | P2 — out of scope |

---

## Score Impact

**Archive: 6.5 → 7.5** — branch routes surface real content and one-click note/trace access.

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Reduce dead-end screens | Met |
| Surface real note content | Met |
| Actionable navigation | Met |
| No redesign | Met |
