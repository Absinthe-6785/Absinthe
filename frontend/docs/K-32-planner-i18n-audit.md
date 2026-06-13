# K-32 — Planner i18n Audit

**Branch:** `k32-planner-consolidation`

---

## Fixed in K-32

| String | Location | Key |
| ------ | -------- | --- |
| `🏖 Exception` | PlannerView routines header | `exception` |
| `Set exception day` (title) | PlannerView | `setExceptionDayTitle` |
| `e.g. Meeting` | Schedule modal | `scheduleTextPh` |
| `Today` | CalendarPeriodNav | `plannerToday` |
| `Previous period` / `Next period` | CalendarPeriodNav aria | `plannerNavPrevPeriod` / `plannerNavNextPeriod` |
| Mobile tab "Planner" for todo column | Mobile tabs | `plannerMobileTabTasks` |
| Weekly timetable empty / hint / CTA | WeeklyTimetableSection | `plannerWeeklyTimetableEmpty*` |

---

## Verified OK (prior milestones)

Calendar mode tabs, weekly timetable modal, D-Day headers, timeline labels, planner carry-over badges — all use `useTranslation()` / `t()`.

---

## Remaining Planner Strings (P2 — out of scope)

| Location | Examples |
| -------- | -------- |
| Schedule category chips | `Study`, `Work`, `Workout`, `Personal`, `Sleep`, `Social` |
| Default auto-fill text | `'Workout'`, `'Sleep'` on category select |
| Exception modal | Uses existing `setException`, `exceptionDesc` keys ✅ |

Category chips are semantic IDs with English display labels — full i18n requires category key map (K-32+).

---

## Verification Matrix

| Surface | EN | KO | JA |
| ------- | -- | -- | -- |
| CalendarShell modes | ✅ | ✅ | ✅ |
| Period nav + Today | ✅ | ✅ | ✅ |
| Mobile tabs | ✅ | ✅ | ✅ |
| Weekly timetable | ✅ | ✅ | ✅ |
| Schedule modal placeholder | ✅ | ✅ | ✅ |
| Exception button | ✅ | ✅ | ✅ |
| Category chips | ⚠️ EN only | ⚠️ | ⚠️ |

---

## Test Coverage

- `calendarShell.test.ts` — English mode expectations
- `plannerWeeklyTimetable.test.ts` — integration markers
- i18n keys added to `frontend/src/lib/i18n.ts`
