# Knowledge-30.3 — Trace Summary Transition

## Scope

First **behavioral** transition from productivity Analytics toward future Trace Summary.

**Changed:** `AnalyticsView.tsx` only — copy, metrics presentation, removed evaluative logic.

**Unchanged:** Sidebar tab name (`Analytics`), routes, layouts, Weekly Timetable, data APIs, Note trace integration (deferred).

Builds on [K-30.2 Analytics Reframing](./Knowledge-30.2-analytics-reframing.md).

---

## Executive Summary

K-30.3 removes Group D evaluative surfaces and reframes Group B widgets as **factual marks and records**. The page title is now **Period Overview** (in-view only; sidebar still says Analytics).

A user opening Analytics should see **evidence of activity**, not **evaluation of performance**.

---

## Removed

Group D surfaces and logic eliminated from `AnalyticsView.tsx`.

| Surface / logic | What it did | Why removed |
| --------------- | ----------- | ----------- |
| **Workout streak** | `🔥 N-day streak` in This Week card | Streak gamification (K-28 anti-goal) |
| **Streak calculation** | `weeklyReview` loop counting consecutive workout days | Same |
| **Evaluative narrative strip** | Entire block: Strong workout week, No workouts yet, Perfect routine week, Routine on track, needs attention, Heavy/Good study week | Life interpretation / performance judgment |
| **Routine completion %** (weekly) | Large `%` with red/amber/green text and progress bar | Completion grading |
| **Days missed** | "X days missed" under routine % | Failure framing |
| **avg Xh/day** (study) | Efficiency metric under weekly study hours | Optimization pressure |
| **Top Focus + %** | Winner category with percent of total | Optimization / ranking language |
| **Routine Success section** | "Today's Routine Rate" % + green/yellow progress bar | Habit success scoring |
| **`routineCompletionRate`** | Computed percentage for today | Same |
| **Productivity heatmap score** | `getLevel()` weighted routine ≥80% as +2, workout count bonuses | Productivity intensity index |
| **Less → More legend** | Implied "more activity is better" | Optimization framing |
| **Page title `Your Analytics`** | Measurement product identity | Replaced in-view (tab unchanged) |
| **Emoji evaluative tooltips** | 💪 ✅ 📚 in heatmap tooltips | Performance celebration tone |

### Computation removed

```typescript
// Removed from weeklyReview useMemo:
routineRate, missedDays, streak

// Removed entirely:
routineCompletionRate
getLevel() productivity score (replaced by getMarkLevel)
```

---

## Reframed

Before / after for every copy and presentation change.

### Page chrome

| Before | After |
| ------ | ----- |
| Your Analytics | **Period Overview** |
| *(sidebar unchanged)* | Analytics |

### Activity This Week (formerly "This Week")

| Before | After |
| ------ | ----- |
| CheckCircle (green) + "This Week" · "Nd in" | Activity icon + **Activity This Week** · "N days in period" |
| Workout · N days · "sessions total" · streak | **Workout records** · N days · "N sessions recorded" |
| Routine · **82%** (colored) + bar + "days missed" | **Routine marks** · **12 / 15** · "marks recorded this week" |
| Study · N hrs · "avg Xh/day" | **Scheduled study** · N hrs · "in schedule blocks" |
| Top Focus · Category · "Xh · Y%" | **Scheduled attention** · Category · "Xh recorded in period" |
| Narrative strip (evaluative) | **Removed** — optional factual: "N exception days noted this week" |

### Scheduled Time by Category (formerly "Time Distribution")

| Before | After |
| ------ | ----- |
| Time Distribution | **Scheduled Time by Category** |
| "5.2h (42%)" | **5.2h** (hours only; bar width still shows relative allocation visually) |

### Activity Calendar (formerly "Activity" heatmap)

| Before | After |
| ------ | ----- |
| Activity | **Activity Calendar** |
| Score 0–4 from weighted productivity algorithm | **Mark level 0–3** = count of mark types present (workout / routine / study) |
| Green intensity gradient (productivity) | Primary opacity gradient (neutral mark density) |
| Less … More | **Fewer marks … More marks** |
| `💪 2 workout(s) · ✅ 3/5 routines` | `2 workout records · Routine marks: 3 of 5 · 1.5h scheduled study` |

### Workout Records (formerly "Workout Days")

| Before | After |
| ------ | ----- |
| Workout Days | **Workout Records** |
| "Tap to mark · Synced from workout records" | **Days with workout records · Tap to toggle display** |

*(Layout and day toggles preserved — move to Health deferred.)*

### Today's Routine Marks (formerly "Routine Success")

| Before | After |
| ------ | ----- |
| Routine Success | **Today's Routine Marks** |
| Today's Routine Rate · **67%** + colored bar | **Routines marked today · 4 of 6** + "routine marks recorded" |
| Exception badge | Preserved (factual context) |

### Today's Schedule (formerly "Today's Detail")

| Before | After |
| ------ | ----- |
| Today's Detail | **Today's Schedule** |
| Content (schedule rows, hours) | Unchanged — already factual |

### New helpers (module level)

```typescript
getMarkLevel(d)        // 0–3 mark types present — not a productivity score
formatHeatmapTooltip(d) // Neutral factual tooltip strings
```

---

## Preserved

Group A sections retained with descriptive wording verified.

| Section | Status | Notes |
| ------- | ------ | ----- |
| **Time range selector** | Unchanged | Today · Weekly · Monthly · Custom |
| **Date range subtitle** | Unchanged | `YYYY-MM-DD ~ YYYY-MM-DD` |
| **Exception Days list** | Unchanged | Collapsible dates + reasons — factual context |
| **Today's Schedule** | Reframed title only | Schedule rows, times, hours preserved |
| **Scheduled Time by Category** | Reframed title; hours preserved | Removed % labels only |
| **Weekly Timetable** | Unchanged | CRUD deferred to K-30.5 move |
| **Workout week grid** | Unchanged layout | Label + footer copy reframed |
| **Custom date pickers** | Unchanged | From / To inputs |
| **Exception day badge** | Unchanged | On today's routine marks when applicable |

---

## Open Questions

What still prevents Analytics from becoming **Trace Summary**?

| Gap | Blocker | Target phase |
| --- | ------- | ------------ |
| **No Note trace data** | Milestones, Events, Activity Overview absent — page shows Planner/Health API marks only | K-30.4 — merge `buildRangeTraceProjection` into period view |
| **Tab still named Analytics** | Sidebar + i18n `analytics` / BarChart2 icon signal measurement | K-30.4 rename after content matches |
| **Weekly Timetable in review tab** | Planning CRUD mixed with period review | K-30.5 move to Planner |
| **Workout toggles in Analytics** | Display override interaction belongs in Health domain | K-30.5 move |
| **Single data silo** | Schedules, workouts, routines from separate APIs — no unified "marks" model | K-30.4+ bridge design |
| **No Areas in period view** | K-29 area lens not intersected with selected range | K-30.4+ |
| **Proportional category bars** | Visual bars still imply allocation comparison — acceptable as evidence if copy stays neutral | Monitor in user testing |
| **Green checkmarks on workout days** | Could read as "success" though meaning "record exists" | Optional neutral indicator in K-30.5 |
| **i18n keys unused in view** | `yourAnalytics`, `routineRate` still in `i18n.ts` — stale until tab rename pass | K-30.4 cleanup |

### Readiness checklist for Trace Summary rename

- [x] Remove streaks, scores, evaluative narratives
- [x] Reframe routine % → counts
- [x] Reframe heatmap → mark calendar
- [x] Neutral page title in-view
- [ ] Add Note Milestones / Events / Activity sections
- [ ] Rename sidebar tab + icon
- [ ] Move Weekly Timetable to Planner
- [ ] Move domain-specific widgets to Health / Planner

---

## Implementation Reference

**File modified:** `frontend/src/components/views/AnalyticsView.tsx`

**Lines of logic removed:** streak loop, narrative `msgs.push` block, `routineCompletionRate`, productivity `getLevel`, colored threshold classes on routine %.

**Tests:** No existing `AnalyticsView` test file. Typecheck passes (`tsc --noEmit -p tsconfig.editor.json`).

---

## Relationship to Prior Milestones

| Milestone | K-30.3 relationship |
| --------- | --------------------- |
| K-30.0 | Identified Analytics as largest philosophy mismatch |
| K-30.1 | Note first; Analytics third — content now less misaligned |
| K-30.2 | Classification applied — Group D removed, Group B reframed |
| K-28 | Anti-goals (streaks, scores, narratives) no longer surfaced in AnalyticsView |

---

*K-30.3 — behavioral transition complete. Tab name unchanged; evaluation removed; evidence preserved.*
