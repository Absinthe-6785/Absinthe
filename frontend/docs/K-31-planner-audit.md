# K-31 — Planner IA Audit

**Branch:** `k31-product-stabilization`  
**Scope:** Task G — surface overlap review (P1)

---

## Surfaces Inventory

| Surface | Host | Primary job |
| ------- | ---- | ----------- |
| Day | `CalendarShell` → `DayCalendarView` | Single-day schedule list + events |
| Week | `CalendarShell` → `WeekCalendarView` | 7-day grid |
| Month | `CalendarShell` → `MonthCalendarView` | Month grid + anchors |
| Agenda | `CalendarShell` → `AgendaCalendarView` | Multi-day horizon list |
| Timeline | Legacy PlannerView column | 48-slot proportional day grid + CRUD |
| Weekly Timetable | `WeeklyTimetableSection` | Recurring weekly template CRUD |
| Legacy 3-column | PlannerView | Routines / Todos / Memo + mini calendar |

---

## Duplicated Functionality

| Feature | Primary | Duplicate | Risk |
| ------- | ------- | --------- | ---- |
| Month browsing | CalendarShell month | Col-3 mini calendar | Two entry points; only legacy shows marked-date dots |
| Day schedules | Day view list | Timeline grid | Same data, different UX; Timeline owns CRUD |
| D-Day display | Shell read-only badges | Col-2 CRUD list | Confusing which is canonical |
| Weekly template | Shell hints | Weekly Timetable section | Only timetable section edits |
| Quick notes | Memo column | Note tab | Redundant with PKM |

---

## Confusing Workflows

1. User opens **Day View** in calendar shell but must drop to **Timeline** to edit timed blocks.
2. **Weekly Timetable** sits below calendar on desktop — looks like part of Day/Week but edits a different model.
3. Mobile tab bar (Routines/Todos/Calendar/Timeline) **parallel** to CalendarShell modes — two navigation mental models.
4. Schedule modal copy is i18n’d but opened from Timeline, not from Day view list actions.

---

## Unnecessary Surfaces (demotion candidates)

| Surface | Recommendation |
| ------- | -------------- |
| Legacy mini calendar (lg+) | Hide when CalendarShell month parity for markers (K-30.37) |
| Mobile `calendar` tab | Retire when shell is default entry |
| Memo column | Collapse to link → Note tab |
| Timeline | Keep until Day view gains schedule CRUD parity |

---

## Hidden Features

- Exception days / routine stats — buried in settings dialogs.
- D-Day CRUD — only in legacy column, not in calendar shell.
- Weekly Timetable — below fold; no sidebar entry.

---

## K-31 Actions

- Localized calendar mode headlines (reduces “foreign” feel).
- No structural demotion in this milestone (per implementation limits).

---

## Recommended Next Milestone

1. Single planner entry: CalendarShell modes + one “Planning” drawer for Timeline/Timetable.
2. Wire Day view schedule actions to existing `dayScheduleActions` (partially started).
3. Retire legacy mobile tabs after parity checklist.

---

## Coherence Score

**5/10** — Rich functionality; navigation model still dual.
