# K-79 Schedule Real Usage Redesign

Redesign Schedule around daily planning workflows — not visual polish alone.

## Before / After Summary

| Area | Before | After |
|------|--------|-------|
| Day mode | Sparse day card + detail panel patterns | **Today dashboard**: agenda + D-days + upcoming week |
| Month layout | 50/50 grid, empty panel half | **70/30** calendar + compact scrollable agenda |
| Month cells | Countdown label only | **D-N + title**, time + title for events/blocks |
| Week cells | Tall rows, low density | **88px min-height**, inline preview line, tighter cards |
| Event editing | Create only; open note to edit | **Click → popover** Edit / Delete / Duplicate |
| Schedule blocks | No edit from agenda list | Same popover + existing modal |
| Knowledge panel | Fixed 230px, long scroll | **Resizable** 180–400px drag handle |

## Part 1 — Today Dashboard

**Root cause:** Day view wrapped `SelectedDayDetailPanel` with large empty chrome and no forward-looking context.

**Fix:** `TodayDashboardView` replaces day content:
- Today section: `UnifiedAgendaList` (schedules, events, D-days in one sort)
- Upcoming This Week: remaining days from week projection
- `+ Add Event` primary action (schedule modal)
- Mode tab renamed **Today** (`plannerCalendarModeDay`)

## Part 2 — Month Calendar Primary Surface

Month cells already showed time + title for blocks/events. **K-79** adds countdown title (`D-3 JLPT`) and slightly denser cell min-heights.

## Part 3 — Detail Panel Space

**Chosen layout:** **70% calendar / 30% agenda panel** (desktop).

Rationale: Keeps month grid readable at 1280px+ while preserving selected-day actions. Bottom-stacked agenda was rejected for desktop because it pushes the calendar off-screen on shorter viewports; side panel with `max-h` scroll keeps both visible.

## Part 4 — Event Editing

- `AgendaItemActionMenu` popover on agenda item click
- `usePlannerScheduleEventActions` + `EventNoteDialog` in `PlannerView`
- Schedule duplicate prefills create modal (`onDuplicate`)

## Part 5 — Unified Agenda Model

| Module | Role |
|--------|------|
| `agendaItemModel.ts` | Build + sort unified items |
| `UnifiedAgendaList.tsx` | Shared list + empty state |
| `AgendaItemActionMenu.tsx` | Shared actions popover |
| `DayAgendaList.tsx` | Thin wrapper (backward compat) |

## Part 6 — Week Density

- Column `min-h` 120→88px, padding reduced
- Event rows `min-h` 40→24px
- `formatWeekDayPreview()` — first event/block in day header

## Part 7 — Timetable Validation

No redesign. `WeeklyTimetableSection` unchanged — standalone weekly grid, no routine/task integration.

## Part 8 — Notes Header Cleanup

- `WeakTopicToggle` height 24px, padding aligned with classification select
- `NoteEditorHeaderActions` meta buttons: `height: 24`, `padding: 3px 6px`
- Header/tag row padding tightened (`6px` / `4px`)

## Part 9 — Knowledge Context Panel

**Option A implemented:** Resizable panel (`useResizablePanelWidth`, localStorage `absinthe-knowledge-panel-width`, 180–400px).

## Files Modified

### New
- `calendar-ui/agenda/agendaItemModel.ts`
- `calendar-ui/agenda/UnifiedAgendaList.tsx`
- `calendar-ui/agenda/AgendaItemActionMenu.tsx`
- `calendar-ui/day/TodayDashboardView.tsx`
- `calendar-ui/day/buildUpcomingWeekGroups.ts`
- `hooks/usePlannerScheduleEventActions.ts`
- `hooks/useResizablePanelWidth.ts`

### Modified
- `DayCalendarView.tsx`, `DayAgendaList.tsx`, `SelectedDayDetailPanel.tsx`
- `MonthCalendarView.tsx`, `MonthCalendarCell.tsx`
- `WeekCalendarView.tsx`, `WeekDayColumn.tsx`, `WeekEventRows.tsx`, `WeekScheduleBlockRows.tsx`
- `CalendarShell.tsx`, `dayScheduleActions.ts`, `PlannerView.tsx`
- `KnowledgeContextPanel.tsx`, `WeakTopicToggle.tsx`, `NoteEditorHeaderActions.tsx`, `NoteViewEditorArea.tsx`
- `i18n.ts`, tests (`dayView.test.tsx`, `dayScheduleExecution.test.ts`, `calendarShell.test.ts`)

## Verification

```bash
cd frontend && npm run typecheck && npm run build && npm run test
```

## Density Improvements

- Today: single scroll-free column, ~30px agenda rows vs prior multi-section gaps
- Month: +40% calendar width; panel capped 300px with scroll
- Week: ~27% shorter columns; preview line removes need to scan empty cells

## Remaining UX Debt

1. Upcoming week is current ISO week only — not rolling 7-day horizon.
2. Event create from Today `+ Add Event` opens **schedule** modal, not note event dialog.
3. Week routine summary text still visible (legacy data, not new UX).
4. No screenshots captured in CI — manual before/after recommended.

## Migration Risks

- **Low:** View mode id remains `day`; only label changed to Today.
- **Low:** `DayAgendaList` API preserved via wrapper.
- **Medium:** Users expecting click-to-open-note on events now see action menu first (Open removed from default click; edit flow in popover).
