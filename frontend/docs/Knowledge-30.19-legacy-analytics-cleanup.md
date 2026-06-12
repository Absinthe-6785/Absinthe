# Knowledge-30.19 — Legacy Analytics Cleanup

## Scope

Execution-path cleanup only. **No widget moves, no UI redesign, no Calendar, no Event/D-Day changes.**

Builds on K-30.16 (Archive default landing), K-30.18 (redistribution audit).

**Problem solved:** When `ARCHIVE_SHELL_ENABLED = true`, legacy Analytics hooks still ran before an early return — causing wasted SWR subscriptions, API requests, and computations with no rendered output.

---

## Executive Summary

**Solution:** Split legacy Analytics into `LegacyAnalyticsView.tsx`. `AnalyticsView.tsx` is now a thin router:

```
ARCHIVE_SHELL_ENABLED = true  → ArchiveShell only (Archive hooks)
ARCHIVE_SHELL_ENABLED = false → LegacyAnalyticsView (legacy hooks)
```

Rules of Hooks preserved — no conditional hook calls inside a single component.

---

## Execution Audit

### Before K-30.19 (Archive enabled)

| Code path | Executed when Archive shown? | Rendered? | Classification |
| --------- | ---------------------------- | --------- | -------------- |
| `useTranslation` | Yes | No | **REMOVE from archive path** |
| `useApiMutation` | Yes | No | **REMOVE** |
| `useConfirm` | Yes | No | **REMOVE** |
| `useState` (timeRange, modals, toggles) | Yes | No | **REMOVE** |
| SWR `/api/routine_exceptions` | Yes | No | **REMOVE** |
| SWR `/api/schedules/range` | Yes | No | **REMOVE** |
| SWR `/api/workouts/range` | Yes | No | **REMOVE** |
| SWR `/api/heatmap` (legacy duplicate) | Yes | No | **REMOVE** — Archive uses separate hook |
| `useMemo` analyticsStart/End | Yes | No | **REMOVE** |
| `useMemo` computedStats | Yes | No | **REMOVE** |
| `useMemo` dailyStats | Yes | No | **REMOVE** |
| `useMemo` weeklyReview | Yes | No | **REMOVE** |
| `useMemo` thisWeekDates / workoutDoneSet | Yes | No | **REMOVE** |
| `useEscapeKey` | Yes | No | **REMOVE** |
| sessionStorage `workoutToggle` init | Yes | No | **REMOVE** |
| ArchiveShell + useArchiveHomeProjection | Yes | Yes | **KEEP** |
| useArchiveDomainMarks → `/api/heatmap` | Yes | Yes | **KEEP** (single Archive fetch) |
| useNotesStore (Archive projection) | Yes | Yes | **KEEP** |

**Net waste per Analytics tab visit (before):** 4 SWR subscriptions + ~8 useMemo/useState initializations + 3 custom hooks — all discarded at early return.

### After K-30.19 (Archive enabled)

| Code path | Executes? |
| --------- | --------- |
| AnalyticsView router | Yes (no hooks) |
| ArchiveShell | Yes |
| useArchiveHomeProjection | Yes |
| useArchiveDomainMarks → `/api/heatmap` | Yes (1 request) |
| useNotesStore | Yes |
| LegacyAnalyticsView | **No — not mounted** |
| All legacy SWR / memos | **No** |

---

## Removed Work

When `ARCHIVE_SHELL_ENABLED = true`:

| Removed | Count / detail |
| ------- | -------------- |
| SWR subscriptions | **3 legacy** (`routine_exceptions`, `schedules/range`, `workouts/range`) |
| Duplicate heatmap fetch | **1** (legacy AnalyticsView heatmap; Archive hook retains sole fetch) |
| Custom hooks per visit | `useTranslation`, `useApiMutation`, `useConfirm`, `useEscapeKey` |
| Local state initializers | 7 (`timeRange`, custom dates, modals, toggles, weekly form) |
| useMemo computations | 6 (`analyticsStart/End`, `computedStats`, `dailyStats`, `weeklyReview`, `thisWeekDates`, `workoutDoneSet`) |
| sessionStorage read | `workoutToggle` parse on mount |

**Total legacy API requests eliminated per Analytics tab open:** up to **4** (3 always + 1 heatmap duplicate).

---

## Preserved Rollback Paths

| Asset | Location | Rollback |
| ----- | -------- | -------- |
| `ARCHIVE_SHELL_ENABLED` flag | `archiveShellConfig.ts` | Set `false` → legacy path |
| Full legacy JSX | `LegacyAnalyticsView.tsx` | Unchanged behavior when mounted |
| Legacy helpers | `LegacyAnalyticsView.tsx` module scope | `CATEGORY_META`, heatmap helpers, `parseTime` |
| Weekly Timetable + CRUD | `LegacyAnalyticsView.tsx` | Available on rollback until K-30.20 move |
| `data-legacy-analytics` marker | Legacy root element | Test + debug identifier |

**No legacy code deleted.** Only execution gating changed.

---

## Performance Impact

| Metric | Before (Archive on) | After (Archive on) | Change |
| ------ | ------------------- | -------------------- | ------ |
| Legacy SWR keys | 4 | 0 | **−4 subscriptions** |
| Archive SWR keys | 1 (`/api/heatmap`) | 1 | unchanged |
| Legacy useMemo runs | 6+ per render | 0 | **eliminated** |
| Legacy hook overhead | 4 custom hooks | 0 | **eliminated** |
| User-visible UX | Archive Home | Archive Home | **unchanged** |

Measured via `analyticsViewArchiveLanding.test.ts` — asserts no legacy SWR keys when Archive enabled.

Rollback verified via `analyticsViewLegacyPath.test.ts` — asserts all 4 legacy SWR keys when flag false.

---

## Remaining Legacy Surface

Still in codebase, dormant when Archive enabled:

| File | Lines (approx) | Next milestone |
| ---- | -------------- | -------------- |
| `LegacyAnalyticsView.tsx` | ~720 | K-30.20 widget moves to Planner/Health |
| `AnalyticsView.tsx` | ~20 | K-30.23 Archive-only target |

Legacy still reachable: `ARCHIVE_SHELL_ENABLED = false`.

---

## Follow-up Work

| Item | Milestone | Notes |
| ---- | --------- | ----- |
| Move Weekly Timetable → Planner | K-30.20 | P0 redistribution |
| Move Workout week grid → Health | K-30.21 | |
| Delete legacy duplicate panels | K-30.22 | Today schedule/routine already in Planner |
| Delete `LegacyAnalyticsView.tsx` | K-30.23 | After moves + rollback window |
| Trim `AnalyticsProps` fields | K-30.23 | `weeklySchedules` → Planner only |

---

## Implementation Summary

| File | Change |
| ---- | ------ |
| `AnalyticsView.tsx` | Thin router — Archive vs Legacy branch |
| `LegacyAnalyticsView.tsx` | **Created** — extracted legacy body + hooks |
| `analyticsViewArchiveLanding.test.ts` | Legacy SWR guard test |
| `analyticsViewLegacyPath.test.ts` | **Created** — rollback path tests |

---

## Success Criteria

- [x] Archive enabled → only Archive-related logic executes
- [x] Legacy Analytics available for rollback (`ARCHIVE_SHELL_ENABLED = false`)
- [x] Rules of Hooks compliant (separate components)
- [x] User-visible experience unchanged
- [x] Tests cover both paths

---

*K-30.19 — execution cleanup complete. Widget redistribution continues at K-30.20.*
