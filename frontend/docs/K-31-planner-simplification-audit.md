# K-31 — Planner Simplification Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P1 — pass 4

---

## View Inventory

| View | Location | Role | Usage |
| ---- | -------- | ---- | ----- |
| **Month** | CalendarShell primary | Month grid + events | High — default calendar mode |
| **Week** | CalendarShell | 7-column day layout | High — weekly planning |
| **Day** | CalendarShell | Single-day sections | Medium — focus day |
| **Agenda** | CalendarShell | Chronological list | Medium — scan upcoming |
| **Timeline** | Planner mobile tab + legacy column | Day schedule blocks | Overlaps Week/Day |
| **Weekly Timetable** | Below planner columns | Recurring weekly blocks | Low — separate API model |

---

## Overlap Analysis

| Pair | Overlap | Recommendation |
| ---- | ------- | -------------- |
| Week ↔ Weekly Timetable | Both show weekly rhythm | Demote timetable (secondary) |
| Day ↔ Timeline (mobile) | Same-day schedule blocks | Keep mobile tab; legacy desktop column remains |
| Month ↔ Agenda | Both list events | Keep both — different mental models |
| CalendarShell ↔ Legacy mini calendar | Duplicate month picker on mobile | Legacy demotion deferred (K-30.32 comment) |

---

## Pass 4 Implementation (Low-Risk)

| Change | Rationale |
| ------ | --------- |
| Weekly Timetable **collapsed by default** when empty | Reduces scroll noise; expand toggle in header |
| Section header icon 22→16, stroke 2.25 | Visual parity with Archive cards |
| Routines header icon 18→16 | Same rhythm as Archive section headers |

**Not changed:** CalendarShell mode switcher, mobile tab bar, legacy timeline column.

---

## Demotion Policy (Documented)

1. **Primary:** CalendarShell modes (Month, Week, Day, Agenda)
2. **Secondary:** Weekly Timetable — collapsed until user expands
3. **Legacy (demote next):** Desktop timeline column, mobile legacy mini-calendar

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Overlap documented | Met |
| Low-risk simplification shipped | Met |
| No Planner redesign | Met |
