# K-74 Planner Domain Cleanup & Workflow Alignment

Branch: `k74-planner-domain-cleanup`

## Goal

Align the planner with real usage — events, deadlines, classes, and recurring commitments — not productivity tracking. No new systems, habits, streaks, or completion metrics.

---

## Part 1 — Planner Domain Cleanup

**Removed from Schedule UI**
- Daily routines panel (`DayRoutineSummary`)
- Tasks panel (`DayTodoSummary`)
- Routine/todo CRUD handlers in `PlannerView`
- Dead exception modal (no trigger)

**Planner is now**
```text
Schedule  → calendar (day/week/month)
Timetable → weekly recurring blocks
```

**Legacy removed**
- Entire `calendar-ui/agenda/` module
- `ScheduleCountdownPanel.tsx`
- `buildAgendaViewPayload` and `agenda` view mode from projection types

---

## Part 2 — Schedule Workspace

**Structure:** `ScheduleWorkspaceNav` — Schedule | Timetable tabs

**Day detail panel order**
1. Schedule timeline (timed blocks)
2. Events & Deadlines (unified section)
3. Month-only: notes created + health activity summary

**Event / countdown unification**
- Single header: Events & Deadlines
- Countdown rows use inline styling matching events
- D-Day labels remain on `DayCountdownStrip` (single implementation)

---

## Part 3 — Timetable Restoration

**`WeeklyTimetableSection`** restored as dedicated Timetable tab (`standalone` mode):
- Always expanded on tab (no collapse toggle)
- Desktop: Mon–Sun time grid
- Mobile: day-grouped list (`data-planner-weekly-timetable-mobile`)

Purpose: classes, work, recurring commitments — not tasks or habits.

---

## Part 4 — Routine Simplification

Routines and tasks **removed from planner surfaces**. Data/API retained elsewhere; no completion %, streaks, or habit UI in Schedule.

Workout routines remain in Health workspace (Day 1–4 split) — unchanged.

---

## Part 5 — Protein Tracker Mobile Audit

**Order preserved:** Progress → Quick Add → Today's Foods → Food Library

**Timeline change**
- Removed precise timestamps (low review value on mobile)
- Shows food name + grams only
- Larger touch targets on delete (44px)

---

## Part 6 — Density Audit

| Area | Change |
|------|--------|
| Schedule day panel | Removed routine/task dead space |
| Timetable tab | Dedicated surface vs buried collapse |
| Protein | Dropped timestamp column width |

---

## Part 7 — Legacy Cleanup

| Removed | Notes |
|---------|-------|
| `agenda/` components + tests | ~23 files |
| `ScheduleCountdownPanel` | Duplicate countdown UI |
| `PlannerCalendarViewMode 'agenda'` | Type narrowed |
| Agenda projection payload | `views.agenda` dropped |

**Retained (data layer only):** todos/routines still in projection index for potential future non-planner use.

---

## Files Modified

| File | Change |
|------|--------|
| `ScheduleWorkspaceNav.tsx` | **New** |
| `PlannerView.tsx` | Schedule/Timetable tabs; removed routine/todo handlers |
| `SelectedDayDetailPanel.tsx` | Events & Deadlines only |
| `WeeklyTimetableSection.tsx` | `standalone` + mobile list |
| `CalendarShell.tsx` | Dropped routine/todo action props |
| `DayCalendarView/Week/Month` | Dropped routine/todo props |
| `DayEventsSection.tsx` | `hideHeading` |
| `DayCountdownStrip.tsx` | `inline` styling |
| `ProteinTracker.tsx` | No timestamps; mobile touch targets |
| `calendar/*` | Agenda removal |
| `calendarPlaceholderSummary.ts` | Day summary without todos/routines |
| Tests | Updated for K-74 contracts |

---

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

---

## Remaining Workflow Debt After K-74

1. Orphan i18n keys (`agendaView`, `scheduleAgendaEmptyHint`) — safe to prune later
2. `DayRoutineSummary` / `DayTodoSummary` components remain exported but unused in Schedule
3. Presentation labels `agendaHorizonLabel` / `agendaDateHeaders` — empty stubs
4. Daily routine reminders — no dedicated surface outside planner data layer (by design)
