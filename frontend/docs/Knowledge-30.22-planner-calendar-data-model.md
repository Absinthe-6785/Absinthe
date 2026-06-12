# Knowledge-30.22 — Planner Calendar Data Model

## Scope

Architecture and read-model design only. **No Calendar UI, no Event note changes, no Schedule model changes, no D-Day migration, no implementation.**

Builds on K-30.17 (Calendar direction), K-30.20 (Weekly Timetable in Planner), and K-30.21 (Event / D-Day convergence).

**Problem:** Planner will become calendar-centered, but data lives in two stores (Note properties + Supabase) with no unified read model. Calendar views cannot be built safely until the projection layer is defined.

**Success questions this document answers:**

1. *If Calendar becomes the Planner landing page, what data model should it consume?*
2. *What appears in Month, Week, Day, and Agenda views?*

---

## Executive Summary

**Calendar consumes one pure projection:**

```
buildPlannerCalendarProjection(input) → PlannerCalendarProjection
```

**Inputs:** notes (events, milestones), schedule blocks for range, weekly template, routines/todos for range, legacy D-Days, anchor date, view mode, `now`, locale.

**Outputs:** UI-independent structures — month grid cells, week columns, day timeline slots, agenda rows, countdown list, period labels.

**View philosophy:**

| View | Primary question | Dominant objects |
| ---- | ---------------- | -------------- |
| **Month** | *When are significant things happening?* | **Events** (anchors) |
| **Week** | *How is my week structured?* | **Events + Schedule blocks + weekly template** |
| **Day** | *What am I doing today, hour by hour?* | **Schedule blocks** (grid) + execution lists |
| **Agenda** | *What’s coming up next?* | **Timed Events + blocks + countdowns + todos** |

**Archive vs Planner Calendar:** Archive observes **marks looking back** (read-only, multi-year). Planner Calendar plans **forward execution** (mutable operational data + read-only note anchors).

---

## Calendar View Analysis

### Month

| Aspect | Specification |
| ------ | ------------- |
| **Purpose** | Orient in time; jump to a day; see upcoming anchors at a glance |
| **Information density** | **Low** — one cell per day; max 2–3 visible chips + overflow indicator |
| **Objects shown** | **Events** (required), **Milestone** dot (optional, subtle), **legacy D-Day** badge (transitional), schedule **count** as secondary hint only |
| **Interaction** | Tap day → switch to Day view; tap event chip → open Event note; no inline CRUD on month grid |
| **Not shown** | Hour grid, routine checklists, todo text, heatmap density, Archive mark types |

### Week

| Aspect | Specification |
| ------ | ------------- |
| **Purpose** | Compare allocation and anchors across seven days |
| **Information density** | **Medium** — 7 columns; timed rows for blocks; all-day row for events |
| **Objects shown** | **Events** (all-day + timed), **Schedule blocks** (solid), **Weekly template** (ghost overlay), routine **completion ratio** (optional footer) |
| **Interaction** | Drag/select day; tap block → existing schedule modal; tap event → Note; template read-only in v1 |
| **Not shown** | Full todo lists, milestone labels, Archive marks |

### Day

| Aspect | Specification |
| ------ | ------------- |
| **Purpose** | Execute today (or selected day) — hour-level planning + checklists |
| **Information density** | **High** — 48-slot timeline + side panels |
| **Objects shown** | **Schedule blocks** (primary grid), **Events** (header strip / all-day row), **Routines**, **Todos**, weekly template **hint** for that weekday |
| **Interaction** | Full CRUD for schedules, routines, todos (existing Planner modals); Event → open note |
| **Replaces** | Current Planner Timeline mobile tab + selected-date columns |

### Agenda

| Aspect | Specification |
| ------ | ------------- |
| **Purpose** | Chronological scan of upcoming items (default horizon: anchor week or +14 days) |
| **Information density** | **Medium** — flat sorted list grouped by date |
| **Objects shown** | **Events** (timed + all-day), **Schedule blocks**, **Countdowns** (future Events + legacy D-Day), **Todos** (per day); **Milestones** only on their date as low-priority rows |
| **Interaction** | Tap row → note or schedule editor; countdown → Event note |
| **Not shown** | Weekly template ghosts, routine checkbox UI (link to Day instead) |

---

## Calendar Object Matrix

| Object | Month | Week | Day | Agenda | Rationale |
| ------ | ----- | ---- | --- | ------ | --------- |
| **Event** | **Yes** — primary chip/dot | **Yes** — all-day row + timed column | **Yes** — header / all-day strip | **Yes** — chronological row | Central **dated anchor** (K-30.21); Month orients by “what happens when” |
| **Schedule block** | **Hint only** — optional small count badge (`3 blocks`) | **Yes** — solid timed columns | **Yes** — **primary** hour grid | **Yes** — timed rows | Operational allocation; too granular for Month primary display |
| **Weekly template** | No | **Yes** — ghost blocks | **Hint** — “template: Study 18:00” | No | Recurring pattern, not dated instance; Week is natural home |
| **Routine** | No | **Optional** — `2/5 done` summary | **Yes** — checklist panel | No (link to Day) | Execution checkbox UX needs Day surface |
| **Todo** | No | No | **Yes** — checklist panel | **Yes** — untimed rows per day | Lightweight daily tasks; Agenda lists them without hour |
| **Milestone** | **Optional** — small dot, no label | No | No | **Optional** — same-day only, deprioritized | Retrospective transition marker; not forward-planning central |
| **Legacy D-Day** | **Yes** — badge until migrated | **Yes** — countdown label | No | **Yes** — countdown section | Transitional dual-read (K-30.21); not steady state |

### Objects excluded from all Calendar views

| Object | Owner | Reason |
| ------ | ----- | ------ |
| Note activity marks | Archive | Historical density, not planning |
| Domain heatmap marks | Archive / Health | Retrospective |
| Productivity aggregates | Retired | K-30.3 |
| Memo / note list | Note | Capture surface |

---

## Projection Architecture

### Design principles

1. **Pure functions** — no React, no SWR, no side effects (mirror `buildArchiveHomeProjection`).
2. **UI-independent** — projection returns data shapes, not JSX or CSS classes.
3. **Single entry, multiple selectors** — one build pass; view components select slices.
4. **Range-first** — compute `[startDate, endDate]` from `viewMode` + `anchorDate`, then fetch/map inputs into that window.
5. **Locale explicit** — pass `locale` from `appSettings.language`; never rely on `undefined` browser default in labels.
6. **Note write authority** — projection reads Events/Milestones from notes; mutations stay in Note or dedicated hooks, not projection.

### Module layout (future)

```
frontend/src/components/views/features/planner/calendar/
├── plannerCalendarModels.ts          // types
├── buildPlannerEventRows.ts          // notes → normalized events + countdowns
├── buildPlannerDayBundle.ts          // per-date aggregation
├── buildPlannerCalendarProjection.ts // orchestrator
├── plannerCalendarRange.ts           // viewMode → date range
├── plannerCalendarLabels.ts          // locale-aware headers
└── *.test.ts
```

### Input shape

```typescript
/** Architecture target — not implemented in K-30.22 */
interface PlannerCalendarProjectionInput {
  /** Vault notes — Events and Milestones extracted here */
  notes: readonly NoteBase[];

  /** Operational data already loaded for projection range */
  scheduleBlocks: readonly Schedule[];           // dated instances in range
  weeklySchedules: readonly WeeklySchedule[];   // full template (7-day pattern)
  todos: readonly PlannerDatedTodo[];           // { date, ...Todo }
  routines: readonly PlannerDatedRoutine[];     // { date, ...Routine }
  legacyDdays: readonly DDay[];

  /** View focus */
  anchorDate: string;                           // YYYY-MM-DD — selected day
  viewMode: PlannerCalendarViewMode;

  /** Clock + i18n */
  now: DateTime;
  locale: PlannerLocale;                        // 'en' | 'ko' | 'ja'

  /** Optional — Planner already has exception awareness */
  routineExceptionDates?: ReadonlySet<string>;
}

type PlannerCalendarViewMode = 'month' | 'week' | 'day' | 'agenda';
```

**Data loading boundary:** Hooks (`useDailyData`, `useStaticData`, `useNotesStore`) fetch raw data. A thin adapter assembles `PlannerCalendarProjectionInput`. Projection does not call APIs.

### Output shape

```typescript
interface PlannerCalendarProjection {
  meta: {
    viewMode: PlannerCalendarViewMode;
    anchorDate: string;
    range: { startDate: string; endDate: string };
    locale: PlannerLocale;
    generatedAt: string;
  };

  /** Locale-resolved chrome */
  labels: PlannerCalendarLabels;

  /** Normalized rows — source-agnostic */
  events: readonly PlannerCalendarEventRow[];
  milestones: readonly PlannerCalendarMilestoneRow[];
  scheduleBlocks: readonly PlannerCalendarBlockRow[];
  weeklyTemplate: readonly PlannerWeeklySlotRow[];
  countdowns: readonly PlannerCountdownRow[];

  /** Index for Month / Week / Day */
  byDate: ReadonlyMap<string, PlannerDayBundle>;

  /** View-specific payloads (precomputed) */
  month: PlannerMonthProjection;
  week: PlannerWeekProjection;
  day: PlannerDayProjection;
  agenda: PlannerAgendaProjection;
}
```

### Core row types

```typescript
interface PlannerCalendarEventRow {
  id: string;                    // noteId
  noteId: string;
  title: string;
  startDate: string;             // eventDate
  endDate: string;               // eventEndDate ?? eventDate
  startTime?: string;            // HH:mm
  endTime?: string;
  isAllDay: boolean;             // !startTime (convention)
  /** Position within multi-day range */
  spanPosition: 'single' | 'start' | 'middle' | 'end';
  source: 'note';
}

interface PlannerCalendarBlockRow {
  id: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  endNextDay: boolean;
  category: string;
  color: string;
  source: 'schedule';
}

interface PlannerWeeklySlotRow {
  id: string;
  weekday: number;               // 0=Mon … 6=Sun (match WeeklySchedule.day)
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  source: 'weekly-template';
}

interface PlannerDayBundle {
  date: string;
  events: readonly PlannerCalendarEventRow[];
  milestones: readonly PlannerCalendarMilestoneRow[];
  blocks: readonly PlannerCalendarBlockRow[];
  todos: readonly Todo[];
  routines: readonly Routine[];
  templateSlots: readonly PlannerWeeklySlotRow[];
  isRoutineException: boolean;
  /** Derived hints for Month cell */
  blockCount: number;
  hasAllDayEvent: boolean;
  hasTimedEvent: boolean;
}

interface PlannerCountdownRow {
  id: string;
  title: string;
  targetDate: string;
  daysUntil: number;             // negative = past
  label: string;                 // D-7, D-Day, D+3 — locale-aware formatter
  source: 'note-event' | 'legacy-dday';
}
```

### Responsibilities and boundaries

| Function | Responsibility | Must not |
| -------- | -------------- | -------- |
| `buildPlannerEventRows(notes, range)` | Parse note Events; expand date ranges; compute `spanPosition` | Fetch notes; render UI |
| `buildPlannerMilestoneRows(notes, range)` | Milestones on exact dates in range | Replace Event rows |
| `buildPlannerBlockRows(schedules, range)` | Filter blocks by date; normalize times | Merge into Event rows |
| `buildPlannerWeeklySlots(template, range)` | Map weekday → dates in range | Persist instances |
| `buildPlannerCountdowns(events, legacyDdays, now)` | Future anchors only; dedupe by date+title | Write D-Day |
| `buildPlannerDayBundle(date, …)` | Assemble per-day index | Know viewMode |
| `buildPlannerCalendarProjection(input)` | Range resolution, orchestration, view payloads | Call hooks/APIs |
| `plannerCalendarLabels(input)` | Month title, weekday headers, period strings | Use browser locale default |

### Relationship to existing projections

| Existing | Calendar reuse |
| -------- | -------------- |
| `buildNoteMarkIndex` | **Same range enumeration** for multi-day Events — do not copy `buildDailyTraceProjection`’s start-date-only filter |
| `readEventFromNote` / `eventNotes.ts` | **Yes** — canonical Event parse |
| `buildDailyTraceProjection` | **No** for range — only matches `eventDate === dateKey`, misses travel/conference spans |
| `buildArchiveMarkCalendarProjection` | **Pattern only** — grid/labels structure, different data |
| `buildCalendarDays` / `buildCalendarMonthGrid` | **Yes** — grid geometry utilities |

**Critical gap today:** `buildDailyTraceProjection` only includes an Event on its **start date**. Calendar projection **must** enumerate every day in `[eventDate, eventEndDate]` (same algorithm as `buildNoteMarkIndex` / `enumerateClippedDateKeys`).

---

## Month View Model

### Primary signal: Events

Month answers *“What significant things happen this month?”* — not *“How busy am I?”*

**Recommended cell content (priority order):**

1. **Event chips** — up to 2 visible titles + `+N` overflow
2. **All-day / multi-day span indicator** — continuous bar across cells for range events (travel, conference)
3. **Legacy D-Day badge** — single icon if countdown entry targets this date (transitional)
4. **Milestone dot** — 1px indicator only, no text (optional v1)
5. **Schedule block count** — optional muted `·3` if blocks exist and no events (secondary; never heatmap)

**Reject as Month primary:**

| Approach | Reason |
| -------- | ------ |
| Schedule density heatmap | Duplicates Archive; implies productivity scoring |
| Routine completion % | Execution detail belongs on Day |
| Todo count badges | Noise at month scale |

### `PlannerMonthProjection` shape

```typescript
interface PlannerMonthProjection {
  year: number;
  month: number;                  // 1–12
  title: string;                  // locale: "June 2026" / "2026년 6월"
  weekdayHeaders: readonly string[]; // Mon–Sun, localized short
  cells: readonly PlannerMonthCell[];
  overflowByDate: ReadonlyMap<string, number>;
}

interface PlannerMonthCell {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: readonly PlannerCalendarEventRow[];  // includes span slices for this day
  milestoneCount: number;
  blockCount: number;
  countdownIds: readonly string[];
  display: {
    primaryChips: readonly { id: string; title: string; kind: 'event' | 'legacy-dday' }[];
    overflowCount: number;
    showMilestoneDot: boolean;
    showBlockHint: boolean;
  };
}
```

**Grid convention:** ISO week (Mon–Sun) to match `buildCalendarDays` in Planner and Weekly Timetable — align with existing Planner, not `buildCalendarMonthGrid`’s Sunday start (resolve at implementation: standardize on Mon-start for Planner Calendar).

---

## Week View Model

### Display strategy: layered columns

Week combines **anchors** (Events) and **allocation** (blocks + template) without merging types.

**Recommended layout:**

```
        Mon    Tue    Wed    Thu    Fri    Sat    Sun
All-day [Exam] [      Travel span      ] [     ]
Timed   ···    ···    ···    ···    ···    ···    ···
Blocks  ███    ░░░    ███    ░░░    ███         ░░░
        study  tmpl   study  tmpl   gym         tmpl
        ^solid schedule   ^ghost weekly template
```

| Layer | Style | Source |
| ----- | ----- | ------ |
| **All-day events** | Top row per column | Events with `isAllDay` or no `startTime` |
| **Timed events** | Distinct marker (icon/chip), not full block height | Events with `eventTime` |
| **Schedule blocks** | Solid colored bars | `/api/schedules?date=` per day in week |
| **Weekly template** | Ghost / dashed bars | `weekly_schedules` matched by weekday |

**Overlap rules:**

| Case | Rule |
| ---- | ---- |
| Event + block same time | **Both render** — Event in all-day/timed row; block in grid below |
| Template + block same slot | Block wins visually (solid over ghost) |
| Two events same day | Stack in all-day row; timed events sorted by `startTime` |

### `PlannerWeekProjection` shape

```typescript
interface PlannerWeekProjection {
  title: string;                  // "Jun 9 – 15, 2026"
  columns: readonly PlannerWeekColumn[];
}

interface PlannerWeekColumn {
  dateKey: string;
  weekdayLabel: string;
  isToday: boolean;
  allDayEvents: readonly PlannerCalendarEventRow[];
  timedEvents: readonly PlannerCalendarEventRow[];
  blocks: readonly PlannerCalendarBlockRow[];
  templateSlots: readonly PlannerWeeklySlotRow[];
  routineSummary?: { done: number; total: number };
}
```

---

## Day View Model

### Recommended section order (top → bottom)

Planner Day is an **execution surface**. Order reflects “what matters first when doing.”

| Order | Section | Content |
| ----- | ------- | ------- |
| **1** | **Date header** | Localized long date, exception-day banner |
| **2** | **Events strip** | All-day + timed Events for this date (read-only; tap → Note) |
| **3** | **Timeline grid** | Schedule blocks — **primary interactive area** (current Planner Timeline) |
| **4** | **Template hint** | If weekly slot exists for this weekday — collapsible reference |
| **5** | **Routines** | Checklist + exception controls |
| **6** | **Todos** | Daily task checklist |
| **7** | **Weekly timetable link** | Scroll anchor to full-width section (K-30.20) — optional collapse |

**Why Events before Schedule grid:** Anchors frame the day (“Exam today”) before hour allocation.

**Why Routines before Todos:** Existing Planner column order; habits are recurring execution backbone.

### `PlannerDayProjection` shape

```typescript
interface PlannerDayProjection {
  dateKey: string;
  title: string;                  // "Thursday, June 12, 2026"
  isToday: boolean;
  isRoutineException: boolean;
  events: {
    allDay: readonly PlannerCalendarEventRow[];
    timed: readonly PlannerCalendarEventRow[];
  };
  timeline: {
    slots: readonly PlannerTimelineSlot[];  // 48 × 30min, height metadata
    blocks: readonly PlannerCalendarBlockRow[];
    carryOverBlocks: readonly PlannerCalendarBlockRow[]; // end_next_day from prev
  };
  templateSlots: readonly PlannerWeeklySlotRow[];
  routines: readonly Routine[];
  todos: readonly Todo[];
}

interface PlannerTimelineSlot {
  index: number;
  time: string;                   // HH:mm
  topPx: number;
  heightPx: number;
}
```

---

## Agenda View Model

### Chronological feed rules

**Horizon:** Default `anchorDate` → `anchorDate + 13 days` (14-day window), or Mon–Sun when launched from Week. Configurable later; not projection concern for v1.

**Inclusion:**

| Type | Include? | Sort key |
| ---- | -------- | -------- |
| Event (timed) | **Yes** | `date + startTime` |
| Event (all-day) | **Yes** | `date + 00:00` (grouped at top of day) |
| Schedule block | **Yes** | `date + startTime` |
| Todo | **Yes** | After all timed items same day, or `date + 23:59` |
| Countdown (future Event / legacy D-Day) | **Yes** — pinned section above list | `daysUntil` ascending |
| Milestone | **Optional** — same day only | After todos, muted |
| Routine | **No** — “View routines on Day” link | — |
| Weekly template | **No** | — |

**Past items:** Include today + future within horizon. Optionally show past 1 day for context — default **future-only** from `anchorDate`.

### Row kinds

```typescript
type PlannerAgendaRowKind =
  | 'countdown'
  | 'all-day-event'
  | 'timed-event'
  | 'schedule-block'
  | 'todo'
  | 'milestone';

interface PlannerAgendaRow {
  id: string;
  kind: PlannerAgendaRowKind;
  dateKey: string;
  sortKey: string;                // ISO-like composite for stable sort
  title: string;
  timeLabel?: string;             // "14:00" or "All day"
  subtitle?: string;            // category, D-120, etc.
  sourceRef: { type: string; id: string };
}

interface PlannerAgendaProjection {
  title: string;
  countdownSection: readonly PlannerAgendaRow[];
  groups: readonly {
    dateKey: string;
    dateLabel: string;
    rows: readonly PlannerAgendaRow[];
  }[];
}
```

---

## Range Event Handling

### Property model (unchanged)

```
eventDate        required
eventTime        optional
eventEndDate     optional
eventEndTime     optional
```

### Expansion algorithm

For each Event note, compute `[startDate, endDate]`:

```
startDate = eventDate
endDate   = eventEndDate ?? eventDate
```

For each `dateKey` in range ∩ projection window, emit a `PlannerCalendarEventRow` with:

| `spanPosition` | Condition |
| -------------- | --------- |
| `single` | startDate === endDate |
| `start` | dateKey === startDate && multi-day |
| `middle` | startDate < dateKey < endDate |
| `end` | dateKey === endDate && multi-day |

Reuse clipping logic from `buildNoteMarkIndex` → `enumerateClippedDateKeys`.

### View-specific rendering

| Scenario | Month | Week | Day | Agenda |
| -------- | ----- | ---- | --- | ------ |
| **Travel** Jun 10–12 | Span bar across 3 cells | Span across columns | Full strip on each day | One row per day or grouped “Travel continues” |
| **Conference** Wed–Fri | Same | Same | Timed sessions if `eventTime` set | Timed rows per day |
| **Project sprint** 2-week range | Overflow chip on busy days | Middle days show continuation chevron | Middle: “Sprint (day 5 of 14)” subtitle | Group header optional v2 |
| **Single-day exam** | One chip | All-day row | Events strip | All-day row |

### Time on range events

| Case | Behavior |
| ---- | -------- |
| `eventTime` on start day only | Timed row on start date; all-day continuation on middle/end days |
| `eventEndTime` on end day | End day may show timed end; architecture allows, UI v2 |
| No times | All days `isAllDay: true` |

**Do not** split Event notes into per-day Schedule blocks — range Events stay note-backed.

---

## Localization Strategy

### Requirements

| Locale | `appSettings.language` |
| ------ | ---------------------- |
| English (default) | `en` |
| Korean | `ko` |
| Japanese | `ja` |

### Problem today

`formatCalendarMonthLabel`, `formatCalendarDayLabel`, and Archive month labels use `toLocaleDateString(undefined, …)` — **browser locale**, not app setting (K-30.17 gap).

### Calendar formatting strategy

**Principle:** `resolvePlannerLocale(appSettings.language) → 'en' | 'ko' | 'ja'`

Pass `locale` into every projection label builder. Static UI strings continue via `useTranslation()` / `i18n.ts`.

| String type | Formatter | Example |
| ----------- | --------- | ------- |
| Month title | `formatPlannerMonthTitle(year, month, locale)` | en: June 2026 · ko: 2026년 6월 · ja: 2026年6月 |
| Week range | `formatPlannerWeekRange(start, end, locale)` | en: Jun 9 – 15, 2026 |
| Day header | `formatPlannerDayTitle(dateKey, locale)` | en: Thursday, June 12, 2026 |
| Weekday headers (short) | `formatPlannerWeekdayShort(dow, locale)` | Mon / 월 / 月 |
| Time | Keep `HH:mm` 24h for consistency across Planner Timeline | Or locale toggle later |
| Countdown | `formatCountdownLabel(daysUntil, locale)` | D-7, D-Day, D+3 — keep convention in ko/ja |
| Quarter (if used) | `formatPlannerQuarter(year, q, locale)` | Q2 2026 / 2026년 2분기 |

### Shared module target

```
plannerCalendarLabels.ts  — wraps Intl + explicit locale map
```

Align with future `formatPeriodLabel` from K-30.17 — one period formatter family for Note trace, Archive, and Planner Calendar.

**Tests:** Snapshot label output for `en`, `ko`, `ja` with fixed dates — no browser dependency.

---

## Archive Separation

### Side-by-side comparison

| Dimension | Planner Calendar | Archive Mark Calendar |
| --------- | ---------------- | --------------------- |
| **Question** | What am I doing next? | What remains when I look back? |
| **Time horizon** | Days → weeks (Agenda up to ~2 weeks) | Months → years (5-year grid) |
| **Interaction** | Mutate schedules, todos, routines; open Event notes | Read-only |
| **Primary data** | Events + Schedule blocks + execution lists | Note marks + domain marks (workout, routine density) |
| **Event role** | Forward anchors, countdown | Historical mark type `event` |
| **Milestone role** | Optional dot | **Recent transitions** centerpiece |
| **Schedule blocks** | Hour grid, CRUD | Not indexed |
| **Heatmap / density** | **Excluded** | Core visualization |
| **Productivity language** | **Excluded** | **Excluded** (K-30.3) |

### Rules preventing Calendar → Archive drift

1. **No mark density scoring** on Planner Month cells.
2. **No 5-year grid** in Planner — Month shows one month only.
3. **No “Activity This Week”** summaries in Calendar.
4. **Events read from notes** — same source as Archive marks, **different projection** (titles/chips vs density types).
5. **Past Events** appear in Calendar only within Agenda lookback window — deep history stays Archive / Note trace.

---

## Recommended Direction

### Data model answer

> **Calendar consumes `PlannerCalendarProjection`**, built from:
>
> - **Note-derived** `PlannerCalendarEventRow[]` + sparse milestones + countdowns  
> - **Supabase-derived** schedule blocks, weekly template, routines, todos  
> - **Legacy** `DDay[]` (transitional countdown source)  
> - **View payloads** precomputed: `month`, `week`, `day`, `agenda`

Hooks fetch raw data → adapter builds input → **one projection function** → view components render slices.

### Per-view content answer

| View | What appears |
| ---- | ------------ |
| **Month** | **Events** primary; milestone dot; legacy D-Day badge; optional block count hint |
| **Week** | **Events** (all-day + timed) + **Schedule blocks** + **weekly template** ghosts + routine summary |
| **Day** | **Events** strip → **Schedule timeline** → template hint → **Routines** → **Todos** |
| **Agenda** | **Countdowns** → chronological **Events + blocks + todos** (+ optional milestones) |

### Central read-model primitives

| Primitive | In projection as |
| --------- | ---------------- |
| Event (note) | `PlannerCalendarEventRow` |
| Schedule block | `PlannerCalendarBlockRow` |
| Weekly template | `PlannerWeeklySlotRow` |
| Routine / Todo | Inside `PlannerDayBundle` |
| Milestone | `PlannerCalendarMilestoneRow` (sparse) |
| Legacy D-Day | `PlannerCountdownRow` until migration |

---

## Migration Path

| Phase | Milestone | Deliverable |
| ----- | --------- | ----------- |
| **0** | **K-30.22 (this doc)** | Calendar read model locked |
| **1** | K-30.23 | `plannerCalendarModels.ts` + `buildPlannerEventRows` + range expansion tests |
| **2** | K-30.24 | `buildPlannerCalendarProjection` core + `byDate` index + label formatters |
| **3** | K-30.25 | Calendar UI — Month + Day (consume `month` + `day` payloads) |
| **4** | K-30.26 | Week + Agenda views |
| **5** | K-30.27 | Planner landing = Calendar; retire mobile Timeline tab naming |
| **6** | K-30.28+ | Event countdown from notes; legacy D-Day dual-read (per K-30.21) |

**Principles:**

1. **Tests before UI** — projection tests with fixture notes + schedules for travel range, exam, mixed week.
2. **Extract `features/planner/calendar/`** — do not grow `PlannerView.tsx`.
3. **Reuse parse helpers** — `readEventFromNote`, `readMilestoneFromNote`, `buildCalendarDays`.
4. **Fix range gap** — do not delegate Event expansion to `buildDailyTraceProjection`.

---

## Risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| `buildDailyTraceProjection` start-date-only reused incorrectly | High | Document and test range expansion separately (this doc) |
| Month becomes second Archive heatmap | Medium | Events-only primary; block count hint muted |
| Week view visual clutter (events + blocks + ghosts) | Medium | Layered rows; template ghost styling; v1 simplify timed events to chips |
| Projection input over-fetching | Medium | Range derived from viewMode; Agenda 14-day cap |
| Locale drift (browser vs app) | Medium | Explicit `locale` param; projection tests for en/ko/ja |
| Grid week-start inconsistency | Low | Standardize Mon-start across Planner Calendar + Weekly Timetable |
| Agenda milestone noise | Low | Optional, deprioritized rows only |
| Dual D-Day + Event countdown duplicates | Medium | Dedupe in `buildPlannerCountdowns` by normalized title+date |
| PlannerView monolith absorbs projection | Medium | Mandatory `features/planner/calendar/` module |

---

## Relationship to Prior Milestones

| Milestone | Relationship |
| --------- | -------------- |
| K-30.21 | Defines primitives and dual-layer model — this doc specifies read-model shapes |
| K-30.20 | Weekly Timetable stays below Day; Week view reads same `weeklySchedules` |
| K-30.17 | Calendar landing vision — this doc specifies consumption model |
| K-30.16 / Archive | Mark calendar pattern — different projection, shared date utilities only |
| K-28 | Event property keys — authoritative parse layer |

---

## Decision Record

| Question | Decision |
| -------- | -------- |
| Calendar data model? | **`PlannerCalendarProjection`** via `buildPlannerCalendarProjection` |
| Month primary content? | **Events** — not schedule density |
| Week overlap strategy? | **Layered** — all-day/timed events + solid blocks + ghost template |
| Day section order? | Events → Timeline blocks → template hint → Routines → Todos |
| Agenda includes? | Countdowns, timed/all-day events, blocks, todos; not routines |
| Range events? | **Enumerate each day** in span; `spanPosition` metadata |
| Milestones in Calendar? | Month dot only; Agenda optional low-priority |
| Localization? | Explicit locale from `appSettings.language` in projection labels |
| vs Archive? | Forward execution vs historical marks — no shared projection |
| Implement now? | **No** |

---

*K-30.22 — architecture only. Next execution: projection module + tests (K-30.23–K-30.24), then Calendar UI (K-30.25+).*
