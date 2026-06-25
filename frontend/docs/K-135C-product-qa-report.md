# K-135C — Product QA Report

**Branch:** `k135c-product-qa-visual-finish`  
**Date:** 2026-06-25  
**Method:** Browser-first verification (Puppeteer, authenticated session) at Desktop (1920), Laptop (1440), Tablet (1024), Mobile (390). Static code audit for scroll/layout edge cases.

**Artifacts:** `/opt/cursor/artifacts/k135c-qa/` (28 screenshots + `report.json`)

---

## Executive summary

Six confirmed UI issues were found (1× P0, 4× P1, 1× P2 deferred). Five were fixed in this milestone. All workspaces render and navigate correctly at four breakpoints. No body-level scroll traps or clipped `max-height` regions were detected post-fix.

---

## Issues found

### P0 — Health: Assemble-routine modal block list not scrollable on mobile

| Field | Detail |
|-------|--------|
| **Workspace** | Health → Routine → Assemble |
| **Severity** | P0 |
| **Description** | On viewports below `lg`, the tag-grouped block picker inside the assemble modal (`max-h-[85vh]`) could not scroll; long block libraries were clipped with no way to reach lower tags. |
| **Root cause** | Block list container used `lg:overflow-y-auto` only — mobile had `overflow: visible` inside a height-capped flex column. |
| **Screenshot** | `health-assemble-mobile.png` (post-fix: list has `overflow-y: auto`) |
| **Status** | **Fixed** — `HealthView.tsx` line ~1661: `flex-1 min-h-0 overflow-y-auto` |

---

### P1 — Settings: Excess bottom padding on mobile

| Field | Detail |
|-------|--------|
| **Workspace** | Settings |
| **Severity** | P1 |
| **Description** | Mobile root used `pb-16` (legacy bottom-nav clearance) while navigation is now top sidebar; created unnecessary dead space at the bottom of long settings pages. |
| **Root cause** | Stale `pb-16 lg:pb-4` on settings workspace root. |
| **Screenshot** | `settings-mobile.png` |
| **Status** | **Fixed** — unified to `pb-4` |

---

### P1 — Health: Root flex child missing `min-h-0`

| Field | Detail |
|-------|--------|
| **Workspace** | Health |
| **Severity** | P1 |
| **Description** | Health workspace root lacked `min-h-0`, inconsistent with Home, Planner, Settings, Archive; risk of nested flex overflow miscalculation on long sessions. |
| **Root cause** | `flex-1 flex flex-col overflow-hidden` without `min-h-0`. |
| **Screenshot** | `health-mobile.png`, `health-desktop.png` |
| **Status** | **Fixed** |

---

### P1 — Notes: Mobile title row wraps instead of truncating

| Field | Detail |
|-------|--------|
| **Workspace** | Notes |
| **Severity** | P1 |
| **Description** | Editor header used `flexWrap: 'wrap'` on mobile; long titles pushed controls to a second row, increasing header height and breaking visual rhythm. |
| **Root cause** | `NoteViewEditorArea.tsx` title row styles. |
| **Screenshot** | `note-mobile.png`, `note-desktop.png` |
| **Status** | **Fixed** — `flexWrap: 'nowrap'` + title `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'` |

---

### P1 — Health: Sticky workout footer may overlap last timeline items

| Field | Detail |
|-------|--------|
| **Workspace** | Health → Today Workout |
| **Severity** | P1 |
| **Description** | Sticky “Complete Workout” dock at bottom could cover the last exercise cards when scrolling a long session. |
| **Root cause** | Timeline container had only `pb-3` while sticky footer is ~72–80px tall. |
| **Screenshot** | `health-mobile.png` (workout tab) |
| **Status** | **Fixed** — conditional `pb-24` when workouts exist |

---

### P2 — Home: Inconsistent empty-state component (deferred)

| Field | Detail |
|-------|--------|
| **Workspace** | Home |
| **Severity** | P2 |
| **Description** | Workout empty uses `ProductEmptyState`; schedule and traces sections use inline dashed-border cards. Cosmetic inconsistency only. |
| **Root cause** | Incremental Home evolution; not a functional defect. |
| **Status** | **Deferred** — polish pass, not blocking production readiness |

---

### P2 — Dev-only: “Static fetch failed” toast on Home (not fixed)

| Field | Detail |
|-------|--------|
| **Workspace** | Home |
| **Severity** | P2 (environment) |
| **Description** | Fresh QA account shows `Static fetch failed: Failed to fetch` when backend static API is unreachable in local dev. |
| **Root cause** | Backend not running in dev QA environment; not a UI regression. |
| **Status** | **Not fixed** (out of scope — no store/provider changes) |

---

## Cross-product audit (browser-verified)

| Check | Result |
|-------|--------|
| Typography / headers | Consistent `font-heading` + workspace subtitles |
| Section spacing | `WORKSPACE_GAP_CLASS` (`gap-3 lg:gap-4`) used across workspaces |
| Border radius | `rounded-absinthe-*` / `rounded-2xl` consistent |
| Buttons / chips | 44px min touch targets on mobile nav and primary CTAs |
| Empty states | Present in all workspaces; minor Home component drift (P2) |
| Scroll behavior | No `body` overflow traps; Settings/Planner use single scroll pane |
| Mobile nav | Top sidebar + More sheet for Settings; works at 390px |

---

## Accessibility (spot check)

| Check | Result |
|-------|--------|
| Sidebar `aria-label` | Present on all tab buttons |
| Focus / keyboard | Skip links visible in Notes (`본문으로 건너뛰기`) |
| Touch targets | Mobile sidebar buttons meet 44px |
| Text truncation | Notes title now ellipsizes on narrow viewports |

---

## Browser verification results

| Viewport | Home | Notes | Health | Schedule | Archive | Settings |
|----------|------|-------|--------|----------|---------|----------|
| Desktop 1920 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Laptop 1440 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tablet 1024 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mobile 390 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

`clippedMaxHeight: 0` across all captured states. Settings and Planner show expected single internal scroll region (`scrollableRegions: 1`).

---

## Issues fixed (summary)

1. Health assemble modal — mobile scroll (`overflow-y-auto` on block list)
2. Health root — `min-h-0` for flex correctness
3. Health workout timeline — `pb-24` clearance above sticky footer
4. Settings — removed legacy `pb-16` mobile padding
5. Notes — mobile title truncation (no wrap)

---

## Remaining issues

- P2 Home empty-state component consistency (deferred)
- P2 Dev backend static fetch error (environment, not UI)
- P2 More sheet lacks mobile theme toggle (pre-existing; low impact — theme available in Settings)

---

## Tooling added

`frontend/scripts/productQaCapture.mjs` — authenticated multi-viewport workspace capture for regression QA.
