# Knowledge-30.2 — Analytics Reframing

## Scope

Analysis and reframing only. **No code deletion, no route renames, no UI redesign, no data migration.**

Builds on [K-30.0 Product Surface Audit](./Knowledge-30.0-product-surface-audit.md) and [K-30.1 Navigation Realignment](./Knowledge-30.1-navigation-realignment.md).

**Central question:**

> What information helps users understand their **traces** — without answering how well they are **performing**?

---

## Executive Summary

`AnalyticsView` is a single monolithic surface (`frontend/src/components/views/AnalyticsView.tsx`) backed by Planner, Health, and schedule APIs — **not** by Note trace projections (K-28/K-29).

It currently answers: *"How am I doing this week?"*

It should eventually answer: *"What left marks during this period?"*

| Finding | Implication |
| ------- | ----------- |
| ~60% of visible widgets use scoring, streaks, or evaluative copy | Reframe or remove framing — not necessarily the underlying data |
| Note trace lenses already provide K-28-aligned period review | Analytics overlaps **in intent** (time-scoped review) but on **wrong data model** |
| Weekly Timetable is planning infrastructure | Belongs in Planner, not a review surface |
| Raw facts (workout days, study hours, schedule rows, exception dates) are often valuable | **Group B (Reframe)** — preserve counts, drop grades |

**Recommended direction:** Rename and rebuild toward **Trace Summary** — a period view that shows **evidence sections** (milestones, events, activity, domain marks) with no scores. Short-term: reframe copy and remove Group D surfaces before any tab rename.

---

## Current Analytics Inventory

### Architecture

| Layer | Location | Role |
| ----- | -------- | ---- |
| View | `AnalyticsView.tsx` | Sole analytics UI — no sub-components |
| Props | `AnalyticsProps` via `AppContent` | `schedules`, `routines`, `weeklySchedules`, `now`, `formatDate`, theme |
| Routing | `activeTab === 'analytics'` | Tab id unchanged |
| i18n | `i18n.ts` — `analytics`, `yourAnalytics`, `weeklyTimetable`, `routineRate`, … | Productivity-leaning labels |

### Data sources (API)

| Endpoint | Used for |
| -------- | -------- |
| `GET /api/schedules/range?start&end` | Time Distribution, Today's Detail |
| `GET /api/heatmap` | This Week card, Activity heatmap (16 weeks) |
| `GET /api/workouts/range?start&end` | Workout Days sync |
| `GET /api/routine_exceptions` | Exception Days list, exception-day logic |
| `GET/POST/PUT/DELETE /api/weekly_schedules` | Weekly Timetable CRUD |

Backend heatmap (`backend/main.py` → `get_heatmap`) aggregates per day: `workout_count`, `routine_done`, `routine_total`, `study_mins`, `is_exception`. Frontend converts to intensity **level 0–4** via a weighted **score**.

### Page chrome

| # | Section | Description |
| - | ------- | ----------- |
| 1 | **Page header** | Title `Your Analytics` + selected date range (`YYYY-MM-DD ~ YYYY-MM-DD`) |
| 2 | **Time range control** | Today · Weekly · Monthly · Custom (+ From/To date inputs) |

### Left column — summary cards

| # | Section | Description | Key metrics / copy |
| - | ------- | ----------- | ------------------- |
| 3 | **This Week** | Weekly review grid (requires heatmap data) | Workout days + sessions; routine **%** with color thresholds; study hours + **avg/day**; **Top Focus** category + **%**; narrative strip |
| 4 | **Time Distribution** | Hours by schedule category (Study, Work, Exercise, …) | Per-category hours + **% of total** + progress bars |
| 5 | **Exception Days** | Collapsible list of routine exception date ranges + reasons | Count badge |
| 6 | **Activity** | 16-week GitHub-style heatmap | Internal **score** from workouts + routine completion + study mins; **Less → More** legend; tooltips with routine done/total |
| 7 | **Workout Days** | Current week Mo–Su toggles | Green checkmarks; tap to override; synced from workout records |
| 8 | **Routine Success** | Today-only routine completion | **Today's Routine Rate** % + colored progress bar (green/yellow/gray thresholds) |
| 9 | **Today's Detail** | Shown when time range = Today | Per-schedule rows: title, time range, hours; daily total hours |

### Right column — planning surface

| # | Section | Description |
| - | ------- | ----------- |
| 10 | **Weekly Timetable** | Full-week recurring schedule grid + Add/Edit/Delete modal |

### Hidden computation (no direct UI, shapes widgets)

| Logic | Location | Effect |
| ----- | -------- | ------ |
| `weeklyReview` | lines 225–253 | Aggregates streak, routineRate, missedDays, topCat, studyHrs |
| Workout **streak** | lines 244–251 | Consecutive days with workouts (exceptions skipped) |
| `getLevel()` score | lines 435–442 | Heatmap intensity from weighted productivity score |
| `routineCompletionRate` | lines 179–181 | Today routines done / total → % |
| `computedStats` | lines 183–205 | Category hours + percent |
| `dailyStats` | lines 208–222 | Today's schedule breakdown |
| `workoutToggle` | sessionStorage | Manual override of workout-day display |

### Overlap with Note trace lenses (K-28)

Note **RangeTraceLensView** / **DailyTraceDayView** already provide, for the same time-scoping intent:

| Note trace section | Data source |
| ------------------ | ----------- |
| Milestones | Note properties |
| Events | Note properties |
| Activity Overview (created / edited notes) | Note timestamps |
| Linked Notes (area lens) | Wiki backlinks |

Analytics provides **none** of these. It shows **Planner schedules**, **Health workouts**, and **routine logs** instead — a parallel, API-siloed "review" that feels like a performance dashboard.

---

## Keep

Information that supports reflection — *what happened, what left marks* — with minimal or reframable productivity framing.

| Surface | Why keep | Notes |
| ------- | -------- | ----- |
| **Time range selector** (Today / Weekly / Monthly / Custom) | Matches "Explore by Time" — same mental model as Note lenses | Keep control; rename labels to mirror Note ("This Month" not "Monthly") in implementation phase |
| **Exception Days list** | Factual context: dates when routines were intentionally paused, with optional reasons | Evidence, not evaluation. Label could become "Noted Exceptions" |
| **Today's Detail** (schedule rows) | Factual log of what was scheduled on a day — times, categories, durations | Planner-sourced **context** for a day; not a score. Pairs with Note daily trace when bridged |
| **Time Distribution — raw hours** | Shows where scheduled time went — attention allocation evidence | Keep **hours per category**; drop **% bars** and "Top Focus" ranking (see Reframe / Remove) |
| **Workout session counts** (decomposed from This Week) | "3 workouts on 2 days" is a mark, not a grade | Keep counts; remove streak and evaluative narrative |
| **Study hours total** (decomposed) | "12 hours of scheduled study blocks" is factual | Keep total; remove avg/day and "Heavy/Good study" labels |
| **Heatmap — date presence** (concept) | Calendar of "days something was recorded" supports Return | Keep only if intensity = **mark density**, not weighted productivity score |
| **Date range subtitle** | Orienting evidence window | Neutral — keep |

**Gap to address in later phases:** Note-based milestones, events, and note activity **do not appear in Analytics today**. A true Trace Summary must **add** K-28 sections — not only reframe existing widgets.

---

## Reframe

Useful information with productivity framing that can survive as **trace vocabulary**.

| Current surface | Current framing | Proposed framing | Group |
| --------------- | --------------- | ---------------- | ----- |
| **This Week → Workout** | "N days" + 🔥 streak | **Workout activity:** "Workouts on N days · M sessions" | B |
| **This Week → Routine** | `82%` red/amber/green + "X days missed" | **Routine activity:** "Routines marked on N of M days" or "12 of 15 routine marks" — counts, not % | B |
| **This Week → Study** | Hours + "avg Xh/day" | **Scheduled study time:** "X hours in schedule blocks" — no daily average | B |
| **This Week → Top Focus** | "Top Focus" + category + % | **Scheduled time by category** — list categories with hours, no winner/loser language | B |
| **This Week → Narrative strip** | Evaluative sentences | **Remove strip** or replace with neutral facts only (see Remove) | B → D for evaluative lines |
| **Time Distribution** | % of total + ranked bars | **Time in schedule blocks** — hours per category, optional note "distribution, not target" | B |
| **Activity heatmap** | Score 0–4 from routine % + workouts + study | **Mark calendar** — cell = "any mark that day" or tiered **count of mark types**, no routine-% weighting | B |
| **Heatmap legend** | Less → More | **Quiet → Active** or **No marks → More marks** | B |
| **Heatmap tooltips** | `✅ 3/5 routines` | **Routine marks: 3 of 5** (neutral) | B |
| **Workout Days** | Tap to mark complete (gamified toggles) | **Days with workout records** — read-only indicator; editing belongs in Health | B → Move interaction to Health |
| **Routine Success** | "Today's Routine Rate" % | **Today's routine marks:** "4 of 6 routines marked" — no progress bar colors | B |
| **Page title** | `Your Analytics` | **`Trace Summary`** or **`Period Overview`** — only after content matches | B (label) |
| **Sidebar tab** | `Analytics` + BarChart2 | **`Summary`** or **`Trace`** + neutral icon (CalendarDays, Layers) | B (label) — K-30.3+ |
| **i18n `routineRate`** | "Routine completion" | "Routine activity" / "Routine marks" | B |

### Reframe principle

Replace:

```
Completion 82%  →  on track / needs attention
```

With:

```
Routines marked on 5 of 7 days this week
```

Replace:

```
🔥 4-day streak
```

With:

```
Workouts recorded on 4 consecutive days (optional footnote: consecutive, not a goal)
```

Or omit consecutive framing entirely — list dates with marks instead.

---

## Move

Information that belongs in another domain — **identify destination only**.

| Surface | Why it doesn't belong in Analytics / Trace Summary | Destination |
| ------- | -------------------------------------------------- | ----------- |
| **Weekly Timetable** (full grid + CRUD modal) | Recurring **planning** infrastructure — defines future blocks, not past marks | **PlannerView** — already has Timeline; Weekly Timetable is duplicate planning surface |
| **Workout Days toggles** (tap to mark) | Mutates display state; workout truth lives in Health API | **HealthView** — read-only week indicator optional; logging stays in Today's Workout |
| **Routine Success (today)** | Operational checklist for **today's** Planner routines | **PlannerView** — alongside Routines column |
| **This Week → Routine %** (planner metric) | Derived from `/api/routine_logs` — Planner domain | **Planner** secondary summary or future Planner "marks log" |
| **Schedule-based Time Distribution** | Derived from Planner `/api/schedules` | **Planner** period view **or** fold into Trace Summary as "Schedule blocks" subsection with clear Planner sourcing |
| **Study hours from schedules** | Planner timeline category aggregation | Same as above |
| **Add / Edit / Delete weekly activities** | Planning CRUD | **Planner** exclusively |

### Cross-domain Trace Summary (future)

A unified **Trace Summary** could **link out** to domain views without hosting their CRUD:

```
Period Overview (2026-06-01 ~ 2026-06-07)
├── Note traces (Milestones · Events · Activity)     ← from Note store
├── Body marks (N workouts)                          ← link → Health
├── Schedule context (categories, hours)             ← link → Planner
└── Noted exceptions (dates)                         ← from routine_exceptions
```

Move CRUD and checklist interactions out; keep read-only aggregates in Summary.

---

## Remove

Surfaces whose **primary purpose** is to score, rank, evaluate, or optimize — no trace-oriented interpretation survives without becoming a different widget.

| Surface / element | Reason | K-28 anti-goal |
| ----------------- | ------ | -------------- |
| **Workout streak** (`weeklyReview.streak`, 🔥 copy) | Continuity gamification | Streak system |
| **Narrative: "Strong workout week"** | Performance judgment | Life interpretation |
| **Narrative: "No workouts yet"** | Guilt-adjacent (😴) | Evaluative narrative |
| **Narrative: "Perfect routine week"** | Success grading | Productivity score |
| **Narrative: "Routine on track"** | Performance approval | Evaluative narrative |
| **Narrative: "Routine needs attention"** | Performance warning | Guilt generation |
| **Narrative: "Heavy study week" / "Good study load"** | Load judgment | Optimization framing |
| **Routine % with red/amber/green** | Completion grade | Productivity score |
| **Routine Success progress bar colors** (green ≥80%, yellow) | Success thresholds | Habit tracker |
| **`missedDays` / "X days missed"** | Failure framing | Guilt generation |
| **Top Focus as winner-take-all** | Optimization / ranking | Performance comparison |
| **Heatmap `getLevel()` score** weighting routine ≥80% as +2 | Productivity intensity index | Productivity dashboard |
| **Heatmap Less → More** (without reframe) | Implies "more is better" | Optimization pressure |
| **avg Xh/day** under Study | Efficiency metric | Optimization |
| **Tab name "Analytics"** (eventually) | Signals measurement product | Productivity dashboard identity |
| **BarChart2 sidebar icon** (eventually) | Visual KPI signal | Same |

### Do not remove (yet) — underlying data

| Data | Action |
| ---- | ------ |
| `/api/heatmap` payload | Keep API; change frontend presentation |
| `routine_done` / `routine_total` | Keep; display as counts |
| `workout_count` | Keep; display as counts |
| `study_mins` | Keep; display as hours |
| Exception dates | Keep |

---

## Candidate Replacements

### Option 1 — Trace Summary (recommended)

```
Analytics  →  Trace Summary
```

| Aspect | Assessment |
| ------ | ---------- |
| K-28 fit | **Strong** — "summary of marks" matches evidence philosophy |
| User clarity | Clear that this is read-only review, not measurement |
| Risk | Name promises note traces; must **add** Milestones/Events/Activity from Note store |
| Icon | Layers, Clock, or BookOpen — not BarChart2 |

**Shape:**

```
Trace Summary
├── Period: [Today | This Week | This Month | Custom]   ← align with Note lenses
├── Milestones                                          ← from notes
├── Events                                              ← from notes
├── Activity Overview                                   ← notes touched
├── Domain marks (optional, factual)                    ← workouts, routine counts
└── Schedule context (optional, collapsed)              ← hours by category, no %
```

**Tradeoff:** Requires merging Note projections into this tab or redirecting tab to Note lens mode — engineering in K-30.3+, not K-30.2.

---

### Option 2 — Review

```
Analytics  →  Review
```

| Aspect | Assessment |
| ------ | ---------- |
| K-28 fit | **Medium** — still sounds like weekly performance review |
| User clarity | Familiar productivity word — may not fix first impression |
| Risk | Low rename cost; **high** risk of retaining wrong mental model |

**Verdict:** Weaker than Trace Summary unless paired with complete content overhaul.

---

### Option 3 — Reflection

```
Analytics  →  Reflection
```

| Aspect | Assessment |
| ------ | ---------- |
| K-28 fit | **Medium-Strong** for philosophy — emphasizes user meaning-making |
| User clarity | Vague — doesn't say *what* is being reflected on |
| Risk | Could imply journaling prompt UI Absinthe doesn't provide |

**Verdict:** Good subtitle ("A place to reflect on what left marks") — weak standalone tab name.

---

### Option 4 — Period Overview / Activity Log

```
Analytics  →  Period Overview
```

| Aspect | Assessment |
| ------ | ---------- |
| K-28 fit | **Strong** — neutral, descriptive |
| User clarity | Less poetic than Trace Summary; very clear scope |
| Risk | May feel dry; doesn't convey Areas or Discovery |

**Verdict:** Safe interim rename if Trace Summary feels too ambitious before Note sections ship.

---

### Option 5 — Eliminate tab; fold into Note (long-term)

```
Analytics tab removed
Review lives in Note → This Month / This Quarter / Custom Range
Domain marks → Health / Planner secondary panels
```

| Aspect | Assessment |
| ------ | ---------- |
| K-28 fit | **Strongest** — single front door |
| User clarity | Simplest product identity |
| Risk | Loses cross-domain single glance until bridges exist |

**Verdict:** Aligns with K-30.0 Option C aspirational model. Requires K-30.4+ bridge work.

---

### Recommendation matrix

| Phase | Tab name | Content |
| ----- | -------- | ------- |
| **K-30.3** | Keep `Analytics` temporarily | Remove Group D copy; reframe Group B widgets |
| **K-30.4** | Rename → **Trace Summary** | Add Note trace sections to same period selector |
| **K-30.5** | Move Group C to Planner/Health | Summary becomes read-only cross-domain view |
| **Long-term** | Optional tab removal | Note lenses + domain links suffice |

---

## Section-by-Section Classification Summary

| # | Section | Group | Future home |
| - | ------- | ----- | ----------- |
| 1 | Page header "Your Analytics" | **Reframe** | Trace Summary / Period Overview |
| 2 | Time range selector | **Keep** | Trace Summary (align labels with Note) |
| 3 | This Week — workout counts | **Reframe** | Trace Summary — domain marks |
| 3 | This Week — streak | **Remove** | — |
| 3 | This Week — routine % | **Reframe** / **Move** | Counts in Summary; detail in Planner |
| 3 | This Week — study hours | **Reframe** | Schedule context subsection |
| 3 | This Week — Top Focus | **Reframe** | Category hours list (unranked) |
| 3 | This Week — narrative strip | **Remove** | — |
| 4 | Time Distribution | **Reframe** | Schedule context — hours only |
| 5 | Exception Days | **Keep** | Trace Summary — context |
| 6 | Activity heatmap (score-based) | **Reframe** | Mark calendar — or **Remove** if Note calendar suffices |
| 7 | Workout Days toggles | **Move** | Health (read-only) |
| 8 | Routine Success % | **Reframe** / **Move** | Planner (today marks) |
| 9 | Today's Detail | **Keep** | Trace Summary — schedule context |
| 10 | Weekly Timetable + CRUD | **Move** | Planner |

---

## Success Criteria (K-30.2 outcomes)

This document satisfies K-30.2 when:

- [x] Every major Analytics section is inventoried
- [x] Each section is classified Keep / Reframe / Move / Remove
- [x] Candidate tab replacements are evaluated with tradeoffs
- [x] Overlap with Note trace lenses is explicit
- [x] No implementation performed

**K-30.3 implementation** should be considered successful when a user opening the reframed tab can answer *"What happened?"* and *"What left marks?"* without encountering streaks, completion grades, or "on track / needs attention" copy.

---

## Deferred (K-30.3+)

| Item | Phase |
| ---- | ----- |
| Remove streak / narrative / color-threshold UI | K-30.3 |
| Reframe routine % → counts | K-30.3 |
| Add Note Milestones / Events / Activity to summary | K-30.4 |
| Rename tab Analytics → Trace Summary | K-30.4 |
| Move Weekly Timetable to Planner | K-30.5 |
| Move Workout Days / Routine Success to domain views | K-30.5 |
| Replace `/api/heatmap` score algorithm | K-30.3 backend + frontend |
| Eliminate Analytics tab entirely | Long-term |

---

## Relationship to K-28 / K-29

| Principle | Analytics today | Target state |
| --------- | --------------- | ------------ |
| Show evidence, not judgment | Violated (narratives, colors, streaks) | Factual counts and lists |
| Show marks, not scores | Violated (%, heatmap score) | Mark presence / mark counts |
| Time is evidence, not a score | Partially (hours exist) undermined by % and avg/day | Hours and dates only |
| Meaning belongs to the user | Violated (system narratives) | No auto-generated evaluations |
| Note traces are primary | Absent from Analytics | Milestones, Events, Activity required in Summary |

---

*K-30.2 — analysis only. Determine what to keep and how to say it before changing a line of UI.*
