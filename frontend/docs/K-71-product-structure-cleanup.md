# K-71 Product Structure Cleanup

Branch: `k71-product-structure-cleanup`

## Goal

Information density, workflow simplification, layout consistency — no new systems, storage changes, or architecture rewrites.

---

## Part 1 — Health Workspace Redesign

**Removed**
- `RecoveryLogPanel` from `HealthView` (dedicated Recovery UI)
- Side-by-side Calendar | InBody | Recovery row

**Retained (data only)**
- Recovery `restDayNote` / `note` merged into workout memo on date change via `getRecoveryEntry()`

**Layout**
- Left (~32%): Routine + Workout Blocks
- Right (~68%): Today's Workout (hero `WORKSPACE_CARD.hero`)
- Below session: Calendar (`WORKSPACE_CARD.md`), then InBody compact strip (`WORKSPACE_CARD.sm`)

---

## Part 2 — Archive Simplification

**Removed**
- Home / Period / Area / Timeline tabs and `ArchiveModeSwitcher`

**Added**
- `ArchiveUnifiedView` — single scrollable page: Recent Transitions, Areas, Timeline links, Browse

**Shell**
- `ArchiveShell` renders unified workspace only (`data-archive-mode="unified"`)

---

## Part 3 — Schedule Simplification

**Removed from UI**
- Agenda tab (`PLANNER_CALENDAR_MODES`: day, week, month only)
- `WeeklyTimetableSection` from `PlannerView`
- `ScheduleCountdownPanel` and legacy timeline side column from `PlannerView`

**Consolidated**
- Countdowns integrated into `SelectedDayDetailPanel` (day/week/month)
- `PlannerView` is calendar-only surface; schedule/routine/todo actions wired through `CalendarShell`

---

## Parts 4–6 — Day / Week / Month Redesign

**Shared**
- `SelectedDayDetailPanel`: schedules, events, countdowns, routines, tasks in one flow

**Day**
- Single-column flow via `DayCalendarView` + `DayHeader`

**Week**
- Week grid top; selected-day timeline bottom; day click updates timeline in-place

**Month**
- Split: calendar left | selected day details right; cell click updates right panel

---

## Part 7 — Card Size Consistency

`frontend/src/components/common/workspaceCardSizes.ts`:

| Tier | Min height |
|------|------------|
| sm   | 120px      |
| md   | 200px      |
| lg   | 360px      |
| hero | 420px      |

Applied to Health workout surfaces and Archive unified sections.

---

## Part 8 — Layout Shift

- Reserved min-heights via `WORKSPACE_CARD` tiers on primary cards
- `WorkspaceCardSkeleton` uses `WORKSPACE_CARD.hero` for workout loading state

---

## Part 9 — Navigation Density

High-confidence removals:
- Recovery panel
- Agenda view
- Weekly timetable block
- Archive tab switcher
- Planner legacy timeline / countdown side column

---

## Files Modified (primary)

| Area | Files |
|------|-------|
| Health | `HealthView.tsx` |
| Archive | `ArchiveShell.tsx`, `ArchiveUnifiedView.tsx` (new) |
| Schedule | `PlannerView.tsx`, `CalendarShell.tsx`, `calendarShellModels.ts`, `CalendarModeSwitcher.tsx` |
| Calendar views | `DayCalendarView.tsx`, `WeekCalendarView.tsx`, `MonthCalendarView.tsx`, `SelectedDayDetailPanel.tsx` (new), `WeekDayColumn.tsx`, `MonthCalendarCell.tsx` |
| Shared | `workspaceCardSizes.ts` (new) |
| Tests | `plannerValidation.test.ts`, `calendarShell.test.ts`, `archiveShell.test.ts`, `analyticsViewArchiveLanding.test.ts` |

---

## Remaining UX Debt

- `RecoveryLogPanel.tsx` / `useRecoveryMetrics.ts` remain in repo but unused in UI
- Month cell inline countdown badges not implemented (countdowns in right panel only)
- No dedicated “add countdown” UI after side panel removal (create via Notes)
- Exception modal in `PlannerView` has no in-calendar trigger
- `WORKSPACE_CARD` not yet applied to Notes / Nutrition surfaces
- Agenda projection code retained for tests/back-compat; not user-facing
