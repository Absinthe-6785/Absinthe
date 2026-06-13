# K-32 — Planner Architecture Audit

**Branch:** `k32-planner-consolidation`  
**Scope:** Document every planner surface before consolidation.

---

## Surface Map

```
PlannerView
├── CalendarShell (always visible)
│   ├── CalendarModeSwitcher → Month | Week | Day | Agenda
│   ├── CalendarPeriodNav → prev / next / today
│   └── View body
│       ├── MonthCalendarView
│       ├── WeekCalendarView
│       ├── DayCalendarView (+ schedule CRUD via dayScheduleActions)
│       └── AgendaCalendarView
├── Mobile tabs (Tasks | Memo | Timeline)
├── Column 1: Routines + To-do
├── Column 2: D-Day + Memo (embedded notes)
├── Column 3: Day Timeline (48-slot schedule)
└── WeeklyTimetableSection (recurring weekly blocks)
```

---

## Day View (CalendarShell `day` mode)

| Concern | Implementation | Overlap |
| ------- | -------------- | ------- |
| Schedule | `DayCalendarView` + `DayScheduleTimeline` | Duplicates legacy Timeline column conceptually |
| Routines | `DayRoutineSummary` in day bundle | Also in Column 1 checklist |
| To-do | `DayTodoSummary` | Also in Column 1 list |
| D-Day | Agenda countdown + legacy list in Column 2 | Two D-Day surfaces |
| Memo | Column 2 embedded notes | Not in CalendarShell |

**K-32 note:** Day calendar view and right-column Timeline both show day schedules — intentional dual entry (calendar summary vs time-grid).

---

## Week View

`WeekCalendarView` — projection-backed week grid with event rows.  
Navigation via shared `CalendarPeriodNav` + `shiftPlannerAnchorDate`.

---

## Month View

`MonthCalendarView` — grid selection calls `onDateSelect` → syncs `selectedDate`.

---

## Agenda View

`AgendaCalendarView` — range list, countdowns, todos, schedules from projection.  
Empty state via `calendarEmptyRange` i18n key.

---

## Weekly Timetable

Separate API (`/api/weekly_schedules`) from day schedules.  
Shows recurring blocks by weekday — distinct from CalendarShell week view (which shows dated events).

---

## Legacy Timeline Column

48-slot vertical timeline in Column 3 — primary schedule CRUD on desktop.  
CalendarShell Day mode reuses same modal via `dayScheduleActions`.

---

## Duplicated / Abandoned UI (pre-K-32)

| Item | Status pre-K-32 | K-32 action |
| ---- | ----------------- | ----------- |
| Mobile legacy mini-calendar | Duplicate of CalendarShell | **Removed** |
| Mobile "Calendar" tab | Redundant with CalendarShell on top | **Removed** |
| Weekly timetable collapsed + hidden add | Discoverability gap | **Improved** |

---

## Overlapping Concepts

1. **Day schedule** — CalendarShell day view vs Timeline column (same data, different visualization)
2. **Routines** — Checklist column vs day summary chip
3. **D-Day** — Legacy list vs agenda countdown section

Consolidation deferred beyond K-32 scope — documented for future milestone.

---

## Unnecessary Panels

None removed beyond legacy mini-calendar. Three-column desktop layout retained for muscle memory; mobile simplified to 3 tabs + CalendarShell.
