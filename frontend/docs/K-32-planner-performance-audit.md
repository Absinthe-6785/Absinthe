# K-32 — Planner Performance Audit

**Branch:** `k32-planner-consolidation`  
**Scope:** Document findings; apply only safe optimizations.

---

## Findings

### 1. Removed legacy mini-calendar computation

**Before:** `PlannerView` called `buildCalendarDays(y, m)` on every `currentDate` change for unused mobile grid (after CalendarShell).  
**After:** Removed — saves array allocation + 42-cell grid render on mobile.

### 2. `sortedSchedules` memo simplified

**Before:** Bundled with `year`, `month`, `calendarDays` in one `useMemo`.  
**After:** Depends only on `schedules` — fewer invalidations.

### 3. `usePlannerCalendarProjection` — notes-driven rebuild

`buildPlannerEventCatalog(notes)` runs whenever **any** note changes.  
Necessary for milestone/event badges on calendar — **not changed** (risky to cache partially).

### 4. Dual schedule fetch

`PlannerView` fetches previous-day schedules via SWR for carry-over timeline blocks.  
Required for `end_next_day` — documented, not removed.

### 5. Timeline DOM

48-slot grid renders 48+ schedule divs — acceptable for single day.  
No virtualization needed at this scale.

### 6. Weekly timetable

24 × 7 grid only renders when expanded — collapsed state skips heavy DOM.

---

## Safe Optimizations Applied

| Change | Impact |
| ------ | ------ |
| Remove `buildCalendarDays` from PlannerView | Less work on month navigation |
| Narrow `sortedSchedules` deps | Fewer memo recomputes |
| Weekly timetable empty collapsed UI | Skips 24-row grid when collapsed + empty |

---

## Deferred (not in K-32)

- Memoize `buildPlannerEventCatalog` with note id + updatedAt fingerprint
- Virtualize timeline at 20+ overlapping blocks
- Lift `CalendarShell` view mode to URL for shareable state

---

## Regression Watch

- Ensure `selectedDate` sync via `handleCalendarAnchorChange` still updates timeline + routines
- Previous-day SWR key unchanged
