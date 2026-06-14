# K-48 Schedule Audit

Audit of the legacy Planner surface before consolidation into **Schedule** (user-facing rename; internal `planner` identifiers retained where refactor cost is high).

## Active architecture (keep)

| Layer | Path | Role |
|-------|------|------|
| Shell | `PlannerView.tsx` | CRUD handlers, modals, side panels, weekly timetable |
| Calendar host | `calendar-ui/CalendarShell.tsx` | Month · Week · Day · Agenda switcher |
| Projection | `calendar/buildPlannerCalendarProjection.ts` | Read model for all calendar modes |
| Weekly templates | `WeeklyTimetableSection.tsx` | Sole CRUD for `weekly_schedules` |
| Timeline CRUD | 48-slot grid in `PlannerView` (week/month only after K-48) | Time-proportional schedule editing |

## Retired in K-48

| Artifact | Reason |
|----------|--------|
| `CalendarViewPlaceholder.tsx` | Superseded by real Agenda/Month/Week/Day views; not mounted |
| Planner **Memo** column | Duplicated Note tab; removed from `PlannerView` |
| Duplicate timeline in Day/Agenda | Hidden when calendar mode is `day` or `agenda`; Day view uses `DayScheduleTimeline` + modal CRUD |
| `markedDates` in `PlannerView` props | Dead after K-32 mini-calendar removal (still fetched in `useStatic` for future Month dots) |

## Legacy widgets still present (intentional)

- **D-Day panel** — legacy countdown CRUD; note-backed events preferred long-term
- **48-slot timeline** — week/month schedule editing only
- **Routines / Tasks columns** — interactive CRUD not yet in calendar shell
- **Schedule category picker** — emoji replaced with Lucide icons (K-48)

## Duplicated logic

| Concern | Locations | K-48 mitigation |
|---------|-----------|-----------------|
| Schedule list | `DayScheduleTimeline` vs 48-slot grid | Day/Agenda: shell only; Week/Month: grid |
| Note editing | Was Memo column vs Note tab | Memo removed |
| Timeline label | `timeline` i18n vs `DayScheduleTimeline` | User label "Schedule" in day sections |

## Dead UI paths (pre-K-48)

- Mobile **Memo** tab — removed
- `CalendarViewPlaceholder` export — removed
- Empty day sections returning `null` — fixed; sections always render with empty state

## State inventory

| State | Owner | Status |
|-------|-------|--------|
| `selectedDate` / `currentDate` | `AppContent` → `PlannerView` | Active |
| `calendarViewMode` | `CalendarShell` (+ callback to `PlannerView`) | Active (K-48) |
| `mobilePlannerTab` | `PlannerView` | Active (`timeline` \| `todo`) |
| Routine/todo/schedule modals | `PlannerView` | Active |
| `markedDates` | `useStatic` | Fetched, not rendered in Schedule |

## Related docs

- `K-32-planner-architecture-audit.md` — prior architecture
- `K-48-schedule-layout-review.md` — view merge/simplify rationale
