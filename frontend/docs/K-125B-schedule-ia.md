# K-125B — Schedule Information Architecture Cleanup

Reorder the unified Schedule workspace to match usage: routine first,
calendar no longer dominates the top of the page.

## Section order

1. Weekly Routine
2. Today
3. Timetable
4. Calendar
5. Upcoming (hidden when empty)

Applied in DOM (`MonthCalendarView`), navigation (`ScheduleSectionNav`), and
smooth-scroll anchors (`scrollToScheduleSection`).

## Density / empty states

- Vertical scroll stack replaces the 28% / 72% agenda/calendar grid split.
- Calendar section capped at `max-h-[min(52vh,520px)]`.
- Routine shows a compact empty hint instead of disappearing.
- Upcoming omits inline add CTA when embedded (sticky New Event remains).
- Timetable embedded add is icon-only to avoid duplicate “first activity” copy.

No projection, CRUD, store, or provider changes.

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm test -- k125b k117 k121 k124c calendarShell monthCalendar
```
