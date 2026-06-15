# K-80 — Schedule Simplification & Calendar-First Redesign

## Rationale

K-74 removed planner concepts from the Schedule workspace. K-79 improved density and usability. Actual usage remained simpler than the UI suggested: users need **future commitments, deadlines, exams, and appointments** — not daily study sessions, habits, routines, or task completion.

K-80 aligns Schedule with an **Apple Calendar–like** model: one month grid that is useful before interaction, plus a single chronological upcoming timeline. No day/week workspaces, no category/color pickers, no separate countdown panel.

## Before / After

| Area | Before (K-79) | After (K-80) |
|------|---------------|--------------|
| Navigation | Today · Week · Month segmented control | Month only — no mode switcher |
| Right panel | Selected-day detail for clicked date | **Upcoming** chronological agenda |
| Event creation | Title, date, time, category, color | Title, date, optional time, **Show as D-Day** |
| Countdowns | Separate conceptual lane in day detail | Unified as schedule variant (`is_dday`) + note events |
| Calendar cells | Time + title, D-N labels (K-79) | Preserved; month is primary surface |
| Layout | 70/30 split | Same split, tighter cells and agenda rows |

## Removed Complexity

- **Today mode** and **Week mode** — unmounted from `CalendarShell`; `PLANNER_CALENDAR_MODES` is `['month']` only.
- **CalendarModeSwitcher** — no longer rendered in Schedule (component file retained for potential reuse).
- **Selected-day detail panel** — replaced by `UpcomingAgendaPanel`.
- **Category / color** pickers in schedule modal — hidden defaults (`purple` / `Personal`).
- **Todo / routine** inputs to calendar projection from Schedule shell — always empty arrays.
- **Separate countdown workspace** — D-Day items created via checkbox; rendered in calendar and agenda like other events.

## Interaction Count Reduction

| Task | Before | After |
|------|--------|-------|
| See what’s coming | Open Schedule → often click dates | Open Schedule → read month cells + Upcoming panel |
| Switch time horizon | 3 mode tabs + period nav | Period nav only (month prev/next) |
| Add deadline | Modal + category + color | Modal: title, date, D-Day checkbox |
| Edit item | Click → popover (K-79) | Unchanged — popover edit/duplicate/delete |

## Information Architecture (Final)

```
Schedule (PlannerView)
├── ScheduleWorkspaceNav
│   ├── Calendar tab  → CalendarShell (month + upcoming)
│   └── Timetable tab → WeeklyTimetableSection (unchanged)
└── Schedule modal
    ├── Title
    ├── Date
    ├── Time (optional; hidden when D-Day)
    └── ☐ Show as D-Day
```

**CalendarShell**

```
CalendarPeriodNav (month)
└── MonthCalendarView (70/30)
    ├── MonthCalendarGrid — cells show time+title, D-N+title, +N more
    └── UpcomingAgendaPanel — date-grouped future items
```

## Affected Files

### Modified

- `calendar-ui/CalendarShell.tsx` — month-only shell
- `calendar-ui/calendarShellModels.ts` — default mode `month`
- `calendar-ui/usePlannerCalendarProjection.ts` — no todos/routines/viewMode input
- `calendar-ui/month/MonthCalendarView.tsx` — upcoming panel wiring
- `calendar-ui/month/MonthCalendarCell.tsx` — denser min-heights
- `calendar/buildPlannerCalendarProjection.ts` — `schedule-dday` countdown merge
- `calendar/calendarModels.ts` — `PlannerCountdownSource` extended
- `calendar-ui/agenda/agendaItemModel.ts` — schedule-dday actions
- `calendar-ui/agenda/UnifiedAgendaList.tsx` — countdown block actions
- `PlannerView.tsx` — simplified modal, D-Day checkbox
- `lib/i18n.ts` — K-80 strings

### Added

- `calendar-ui/agenda/buildUpcomingAgendaGroups.ts`
- `calendar-ui/agenda/UpcomingAgendaPanel.tsx`
- `calendar-ui/agenda/UpcomingAgendaGroupList.tsx`

### Tests updated

- `calendarShell.test.ts`
- `month/monthCalendar.test.ts`
- `day/dayScheduleExecution.test.ts`

### Retained but unmounted (UX debt)

- `day/*`, `week/*` view components
- `CalendarModeSwitcher.tsx`
- `SelectedDayDetailPanel.tsx` and related day-history extras

## Migration Considerations

- **Internal models** — `Schedule.is_dday`, note-backed events, and projection `byDate` bundles unchanged. D-Day schedules are duplicated into `core.countdowns` with source `schedule-dday` for unified rendering.
- **Existing schedules** — category/color fields remain in storage; UI no longer exposes them. New items use theme purple.
- **Timetable** — separate tab; no integration with routines/habits/planner.
- **Day/week tests** — still exist for legacy components; Schedule shell tests target month-only path.

## Philosophy Audit (K-80)

Schedule answers: **What important future dates should I not forget?**

Verified removed from active Schedule UI:

- Task systems, habit systems, routine completion
- Productivity scoring, progress tracking
- Daily study logging, workout linkage
- Day/week planner workspaces

Timetable remains for recurring weekly commitments (classes, work) only.

## Remaining UX Debt

1. Dead code: day/week views, mode switcher, selected-day panel files.
2. `PlannerView` may still receive `todos`/`routines` props from parent — unused for calendar.
3. Category/color still stored on legacy schedule rows.
4. Empty-month hint in grid header removed (low priority).
5. Screenshots/density comparison — capture manually in dev build.

## Visual Theme

Dark Absinthe theme, purple primary accents, and existing card/border tokens preserved. No rainbow category system in Schedule creation flow.
