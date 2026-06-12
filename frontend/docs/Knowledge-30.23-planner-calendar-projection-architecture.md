# Knowledge-30.23 — Planner Calendar Projection Architecture

## Scope

Architecture and projection-layer design only. **No Calendar UI, no routes, no Event/Schedule model changes, no D-Day migration, no implementation.**

Builds on K-30.22 (Calendar data model — *what* views show). This document defines *how* `buildPlannerCalendarProjection()` builds that data.

**Success questions this document answers:**

1. *What should `buildPlannerCalendarProjection()` look like?*
2. *What projection architecture supports Month, Week, Day, and Agenda without future redesign?*

---

## Executive Summary

Planner Calendar requires a **two-layer read pipeline**:

```
Raw inputs (hooks)  →  buildPlannerCalendarProjection(input)  →  PlannerCalendarCoreProjection
                                                              ↓
                                    formatPlannerCalendarPresentation(core, locale)  →  labels (optional, still pure)
                                                              ↓
                                                         Calendar UI components
```

**`buildPlannerCalendarProjection` responsibilities:** resolve range → normalize rows → expand multi-day events → build `byDate` index → assemble view payloads.

**Must not:** fetch data, render UI, or embed locale-formatted strings in the core projection.

**Critical implementation rule:** **Single-pass note scan** with range clipping (Archive `buildNoteMarkIndex` pattern). **Never** loop `buildDailyTraceProjection` per day (Range Trace anti-pattern for Calendar).

**Stable output shape:** `PlannerCalendarProjection` always exposes `core`, `byDate`, and four view slots (`month`, `week`, `day`, `agenda`). Inactive views may be minimally populated in v1, but keys never change.

---

## Projection Responsibilities

### Entry point

```typescript
/** Pure orchestrator — architecture target, not implemented in K-30.23 */
function buildPlannerCalendarProjection(
  input: PlannerCalendarProjectionInput,
): PlannerCalendarProjection;
```

### Pipeline stages

| Stage | Function (future) | Responsibility |
| ----- | ----------------- | -------------- |
| **0 — Range** | `resolvePlannerCalendarRange(viewMode, anchorDate)` | Compute inclusive `[startDate, endDate]` and grid bounds |
| **1 — Normalize** | `buildPlannerEventCatalog`, `normalizeScheduleBlocks`, … | Map raw inputs → typed row structs |
| **2 — Expand** | `expandEventOccurrences(catalog, range)` | Multi-day Events → per-date occurrences with `spanPosition` |
| **3 — Index** | `buildPlannerByDateIndex(...)` | `Map<dateKey, PlannerDayBundle>` — canonical lookup |
| **4 — Derive views** | `buildPlannerMonthView`, `buildPlannerWeekView`, … | View payloads from index + shared rows |
| **5 — Countdowns** | `buildPlannerCountdowns(events, legacyDdays, now)` | Future anchors; dedupe legacy vs note Events |

**Presentation (outside core projection):**

```typescript
function formatPlannerCalendarPresentation(
  projection: PlannerCalendarProjection,
  locale: PlannerLocale,
): PlannerCalendarPresentation;
```

Returns month titles, weekday headers, countdown labels (`D-7`), day headers — all formatted strings.

### Must do

| Responsibility | Detail |
| -------------- | ------ |
| **Normalization** | One canonical row type per source (`PlannerCalendarEventOccurrence`, `PlannerCalendarBlockRow`, …) |
| **Date expansion** | Enumerate every day in `[eventDate, eventEndDate]` clipped to projection range |
| **Indexing** | O(1) day lookup via `byDate`; pre-group blocks/todos/routines by date |
| **View preparation** | Pre-sort agenda rows; pre-split all-day vs timed events; precompute month cell display hints |
| **Determinism** | Same input → same output; stable sort keys for tests |

### Must not do

| Forbidden | Reason |
| --------- | ------ |
| HTTP / SWR / store reads | Fetching belongs in hooks/adapters |
| JSX / CSS classes | UI layer |
| Locale-formatted strings in **core** | See Localization Boundaries |
| Mutations / CRUD | Write paths stay in hooks |
| Productivity scoring | Retired K-30.3 |

---

## Input Model Audit

### Adapter boundary

Hooks assemble input; projection never fetches.

| Source today | Hook / store | Adapter responsibility |
| ------------ | ------------- | ---------------------- |
| Notes | `useNotesStore` | Pass active notes array |
| Schedule blocks | `useDailyData` (per date) | Fetch range: loop dates or future range API |
| Weekly template | `useStaticData` | Pass full `weeklySchedules` |
| Todos / Routines | `useDailyData` | Pass `{ date, item }[]` for range |
| Legacy D-Days | `useStaticData` | Pass `ddays` |
| Clock | `AppContent` `now` | Pass `DateTime` |
| View focus | Planner UI state | `anchorDate`, `viewMode` |

**Future optimization:** `GET /api/schedules/range?start=&end=` reduces adapter fetches — not required for projection shape.

### Per-input evaluation

| Input | Required? | Used in views | Future compatibility |
| ----- | --------- | ------------- | -------------------- |
| **Events** (via `notes`) | **Yes** | Month, Week, Day, Agenda | Primary anchor layer (K-30.21); stable |
| **Milestones** (via `notes`) | **Optional** | Month dot, Agenda low-priority | Stable; sparse |
| **Schedule blocks** | **Yes** | Week, Day, Agenda; Month hint | Stable; operational core |
| **Weekly templates** | **Yes** | Week, Day hint | Stable since K-30.20 |
| **Routines** | **Yes** | Day; Week summary | Stable |
| **Todos** | **Yes** | Day, Agenda | Stable; note-task bridge later |
| **Legacy D-Days** | **Optional** (transitional) | Month badge, Week, Agenda countdown | **Deprecated** — dual-read until K-30.28+ |
| **`routineExceptionDates`** | **Optional** | Day banner | Stable |
| **`now`** | **Yes** | `isToday`, countdowns, past/future filter | Stable |
| **`locale`** | **Presentation only** | Not passed to core builder | See Localization Boundaries |

### `PlannerCalendarProjectionInput` (final)

```typescript
interface PlannerCalendarProjectionInput {
  notes: readonly NoteBase[];
  scheduleBlocks: readonly Schedule[];              // must cover resolved range
  weeklySchedules: readonly WeeklySchedule[];
  todos: readonly PlannerDatedTodo[];                 // { date: string } & Todo
  routines: readonly PlannerDatedRoutine[];         // { date: string } & Routine
  legacyDdays: readonly DDay[];

  anchorDate: string;
  viewMode: PlannerCalendarViewMode;

  now: DateTime;

  routineExceptionDates?: ReadonlySet<string>;

  /** Optional performance cache — same notes reference → skip catalog rebuild */
  eventCatalog?: PlannerEventCatalog;
}

type PlannerCalendarViewMode = 'month' | 'week' | 'day' | 'agenda';
```

**Note:** `locale` removed from core input (refinement from K-30.22). Locale applies in `formatPlannerCalendarPresentation`.

---

## Projection Shape

### Top-level output

```typescript
interface PlannerCalendarProjection {
  meta: PlannerCalendarMeta;
  core: PlannerCalendarCore;
  byDate: ReadonlyMap<string, PlannerDayBundle>;
  views: PlannerCalendarViews;
}

interface PlannerCalendarMeta {
  viewMode: PlannerCalendarViewMode;
  anchorDate: string;
  range: { startDate: string; endDate: string };
  generatedAt: string;                             // ISO from now
}

interface PlannerCalendarViews {
  month: PlannerMonthViewPayload;
  week: PlannerWeekViewPayload;
  day: PlannerDayViewPayload;
  agenda: PlannerAgendaViewPayload;
}
```

All four view keys **always present** — satisfies future UI compatibility. v1 implementation may fully build only `views[viewMode]` and return stub payloads for others; shape unchanged when lazy optimization added.

### Core layer (locale-independent)

```typescript
interface PlannerCalendarCore {
  /** Canonical normalized rows clipped to range */
  eventOccurrences: readonly PlannerEventOccurrence[];
  milestones: readonly PlannerMilestoneRow[];
  scheduleBlocks: readonly PlannerBlockRow[];
  weeklySlots: readonly PlannerWeeklySlotRow[];
  countdowns: readonly PlannerCountdownRow[];

  /** Flat indexes for non-date-scoped access */
  eventsByNoteId: ReadonlyMap<string, PlannerEventDefinition>;
  blocksById: ReadonlyMap<string, PlannerBlockRow>;
}
```

### Why split `core` + `byDate` + `views`?

| Layer | Purpose |
| ----- | ------- |
| **`core`** | Normalized facts — reusable if multiple views rendered in one frame |
| **`byDate`** | Canonical date index — shared by Month, Week, Day, Agenda |
| **`views`** | View-optimized materializations — avoids UI recomputing sort/filter |

### Row types (structural only)

```typescript
/** One note-backed event definition (span metadata) */
interface PlannerEventDefinition {
  noteId: string;
  title: string;
  startDate: string;
  endDate: string;
  startTime?: string;                              // HH:mm
  endTime?: string;
  isAllDay: boolean;
}

/** One calendar day slice of a multi-day event */
interface PlannerEventOccurrence {
  occurrenceId: string;                            // `${noteId}:${dateKey}`
  noteId: string;
  title: string;
  dateKey: string;
  spanPosition: 'single' | 'start' | 'middle' | 'end';
  isAllDay: boolean;
  startTime?: string;                              // only on start day when timed
  endTime?: string;
  definition: PlannerEventDefinition;              // back-reference
}

interface PlannerDayBundle {
  dateKey: string;
  weekday: number;                                 // 0=Mon … 6=Sun (ISO)
  events: readonly PlannerEventOccurrence[];
  milestones: readonly PlannerMilestoneRow[];
  blocks: readonly PlannerBlockRow[];
  todos: readonly Todo[];
  routines: readonly Routine[];
  weeklySlots: readonly PlannerWeeklySlotRow[];
  isRoutineException: boolean;

  /** Precomputed display hints (numeric/boolean — no formatted strings) */
  hints: {
    blockCount: number;
    eventCount: number;
    hasAllDayEvent: boolean;
    hasTimedEvent: boolean;
    milestoneCount: number;
    primaryEventNoteIds: readonly string[];        // max 2 for month chips
    overflowEventCount: number;
  };
}
```

---

## Range Expansion Strategy

### Problem

Event notes store `eventDate` + optional `eventEndDate`. Calendar must show **each day** in a travel/conference/sprint span without re-scanning the vault on every navigation.

### Algorithm (single pass)

```
for each active note where isEventNote:
  parse readEventFromNote(note)
  definition = normalize definition (startDate, endDate, times)
  for dateKey in enumerateClippedDateKeys(startDate, endDate, rangeStart, rangeEnd):
    emit PlannerEventOccurrence with spanPosition(dateKey, startDate, endDate)
```

**Reuse:** Extract `enumerateClippedDateKeys` from `buildNoteMarkIndex.ts` into shared `dateRangeUtils.ts` (used by Archive + Planner). Do not duplicate loop logic.

### `spanPosition` rules

| Condition | `spanPosition` |
| --------- | -------------- |
| `startDate === endDate` | `single` |
| `dateKey === startDate` (multi-day) | `start` |
| `dateKey === endDate` (multi-day) | `end` |
| otherwise | `middle` |

### Timed range events

| Case | Occurrence behavior |
| ---- | ------------------- |
| No `eventTime` | All days `isAllDay: true` |
| `eventTime` on start only | `startTime` on start day; middle/end all-day continuation |
| `eventEndTime` on end day | `endTime` on end day only (v1); middle days all-day |

### Examples

| Event | Range | Occurrences in June view |
| ----- | ----- | ------------------------ |
| **Travel** Jun 10–12 | 3 days | 3 occurrences; Month span bar; Week 3-column span |
| **Conference** Wed–Fri | 3 days | Same; Agenda one row per day or grouped header (view layer) |
| **Study camp** 14 days | 14 occurrences | Month shows overflow `+N`; Agenda uses continuation subtitle (view layer) |
| **Project sprint** 2 weeks | 14 occurrences | Week shows middle-day chevron in payload `hints` |

### `PlannerEventCatalog` (performance)

For large vaults, build catalog **once per notes snapshot**:

```typescript
interface PlannerEventCatalog {
  definitions: readonly PlannerEventDefinition[];
  byNoteId: ReadonlyMap<string, PlannerEventDefinition>;
}

function buildPlannerEventCatalog(notes: readonly NoteBase[]): PlannerEventCatalog;

function expandEventOccurrences(
  catalog: PlannerEventCatalog,
  range: { startDate: string; endDate: string },
): PlannerEventOccurrence[];
```

Adapter passes cached `eventCatalog` when `notes` reference unchanged — projection clips without re-parsing every note property.

### Anti-pattern (do not use)

```typescript
// ❌ O(rangeDays × notes) — buildRangeTraceProjection pattern
for (const dateKey of enumerateDateKeys(start, end)) {
  buildDailyTraceProjection(dateKey, notes); // misses multi-day except start date
}
```

`buildDailyTraceProjection` only matches `eventDate === dateKey` — wrong for travel spans. Range Trace remains Note-only; Planner Calendar uses Archive-style expansion.

---

## View Payload Design

### Shared vs view-specific

| Data | Shared source | Used by |
| ---- | ------------- | ------- |
| `byDate` | Index stage | All views |
| `core.eventOccurrences` | Expand stage | Week, Agenda sorting |
| `core.countdowns` | Derive stage | Month badges, Agenda header |
| `core.weeklySlots` | Normalize stage | Week, Day |
| Grid geometry | `buildPlannerMonthGrid`, week column list | Month, Week only |
| Timeline slot math | 48 × 30min constants | Day only |
| Agenda sort keys | Precomputed rows | Agenda only |

### Month payload

```typescript
interface PlannerMonthViewPayload {
  year: number;
  month: number;                                   // 1–12
  gridStartDate: string;
  gridEndDate: string;
  weekdayOrder: readonly number[];                 // [0..6] Mon-first
  cells: readonly PlannerMonthCellPayload[];
}

interface PlannerMonthCellPayload {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isAnchorSelected: boolean;
  bundle: PlannerDayBundle;                        // reference into byDate
}
```

**Contains:** cell geometry + pointer to `PlannerDayBundle` (events + hints). **Does not contain:** formatted month title (presentation layer).

### Week payload

```typescript
interface PlannerWeekViewPayload {
  startDate: string;
  endDate: string;
  columns: readonly PlannerWeekColumnPayload[];
}

interface PlannerWeekColumnPayload {
  dateKey: string;
  bundle: PlannerDayBundle;
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
  blocks: readonly PlannerBlockRow[];
  templateSlots: readonly PlannerWeeklySlotRow[];
  routineSummary: { done: number; total: number } | null;
}
```

**Shared:** splits derived from `bundle` — not recomputed in UI.

### Day payload

```typescript
interface PlannerDayViewPayload {
  dateKey: string;
  bundle: PlannerDayBundle;
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
  timeline: {
    slotCount: 48;
    slotMinutes: 30;
    blocks: readonly PlannerBlockRow[];
    carryOverBlocks: readonly PlannerBlockRow[];   // from previous day end_next_day
  };
  isToday: boolean;
}
```

**Shared:** `carryOverBlocks` resolved in projection from prior-day blocks — UI does not fetch previous day separately.

### Agenda payload

```typescript
interface PlannerAgendaViewPayload {
  horizon: { startDate: string; endDate: string };
  countdownSection: readonly PlannerAgendaItem[];
  dayGroups: readonly {
    dateKey: string;
    items: readonly PlannerAgendaItem[];
  }[];
}

interface PlannerAgendaItem {
  id: string;
  kind: 'countdown' | 'all-day-event' | 'timed-event' | 'block' | 'todo' | 'milestone';
  dateKey: string;
  sortKey: string;                                 // `${dateKey}T${timeOrRank}` locale-free
  title: string;
  sourceRef: { type: string; id: string };
  meta: {
    startTime?: string;
    endTime?: string;
    daysUntil?: number;
    category?: string;
    done?: boolean;
  };
}
```

**Horizon defaults:**

| Launched from | `startDate` | `endDate` |
| ------------- | ----------- | --------- |
| Agenda mode | `anchorDate` | `anchorDate + 13 days` |
| Week mode → Agenda | week `startDate` | week `endDate` |

Cap: **14 days** (align with `MAX_RANGE_DAYS` discipline — Agenda well under 366).

---

## Indexing Strategy

### Primary index: `byDate`

**Structure:** `Map<string, PlannerDayBundle>`

**Build:**

1. `enumerateDateKeys(range.startDate, range.endDate)` — reuse from `buildRangeTraceProjection` / shared util
2. Initialize empty bundle per key
3. Single-pass assign: occurrences, milestones, blocks, todos, routines, weekly slots (by weekday)
4. Finalize `hints` per bundle

**Lookup complexity:** O(1) per day — satisfies Month (≤42 cells), Week (7), Day (1), Agenda (≤14 groups).

### Secondary indexes (in `core`)

| Index | Key | Purpose |
| ----- | --- | ------- |
| `eventsByNoteId` | noteId | Tap event → open note without scan |
| `blocksById` | block id | Tap block → schedule modal |
| `countdowns` | sorted array | Agenda header; not keyed by date alone |

### Not required

| Alternative | Verdict |
| ----------- | ------- |
| Separate `byWeek` map | **Reject** — 7 consecutive keys from `byDate` |
| Separate `byMonth` map | **Reject** — filter cells by month prefix |
| R-tree / interval tree | **Reject** — max range ≤ 42 days (month grid); linear scan sufficient |

### Week / month range resolution

```typescript
function resolvePlannerCalendarRange(
  viewMode: PlannerCalendarViewMode,
  anchorDate: string,
): { startDate: string; endDate: string; month?: { year: number; month: number } } {
  switch (viewMode) {
    case 'month':  return monthGridBounds(anchorDate);   // include leading/trailing pad days
    case 'week':   return isoWeekBounds(anchorDate);     // Mon–Sun
    case 'day':    return { startDate: anchorDate, endDate: anchorDate };
    case 'agenda': return { startDate: anchorDate, endDate: addDays(anchorDate, 13) };
  }
}
```

Month grid bounds ⊇ calendar month — ensures `byDate` covers all visible cells.

---

## Reuse Opportunities

### Reuse directly

| Utility | Location | Planner use |
| ------- | -------- | ----------- |
| `readEventFromNote`, `isEventNote` | `eventNotes.ts` | Event normalization |
| `readMilestoneFromNote`, `isMilestoneNote` | `milestoneNotes.ts` | Milestone rows |
| `parseDateKey`, `toDateKey` | `parseDatabaseDate.ts` | All date keys |
| `enumerateClippedDateKeys` | `buildNoteMarkIndex.ts` | **Extract to shared** — range expansion |
| `isDateInRange` | `archiveMarkUtils.ts` | **Extract to shared** — clip checks |
| `enumerateDateKeys` | `buildRangeTraceProjection.ts` | Range day list (with max cap) |
| `buildCalendarDays` | `calendarUtils.ts` | Month grid leading nulls (Mon-start) |

### Reuse pattern, not implementation

| System | Reuse | Do not reuse |
| ------ | ----- | ------------ |
| **Archive Home** | Orchestrator pattern (`buildArchiveHomeProjection`), pure tests | Mark density, domain marks, 5-year grid |
| **buildNoteMarkIndex** | Single-pass + enumerate algorithm | `ArchiveMarkIndex` type, mark types |
| **Daily Trace** | `compareEvents` sort logic (optional) | Per-day event filter |
| **Range Trace** | `enumerateDateKeys`, lens bounds helpers | `buildRangeTraceProjection` inner loop |
| **Area Trace** | — | Entire module — different product question |
| **Database Calendar** | Month grid cell shape ideas | Note bucketing pipeline |

### New shared module (recommended)

```
frontend/src/lib/dateRangeUtils.ts
  enumerateClippedDateKeys(start, end, clipStart, clipEnd)
  enumerateDateKeys(start, end, maxDays?)
  isDateInRange(dateKey, start, end)
  isoWeekBounds(anchorDate)
  monthGridBounds(anchorDate)
  addDays(dateKey, delta)
```

Archive and Planner both import — eliminates third copy of date loops.

### Must remain separate

| Concern | Reason |
| ------- | ------ |
| `buildPlannerCalendarProjection` inside Archive | Different outputs, mutations, horizons |
| Merging Event rows into Schedule rows | K-30.21 dual-layer model |
| Note activity marks in Calendar | Archive-only |

---

## Localization Boundaries

### Principle

**Core projection is locale-independent.** All user-visible formatted strings are produced by **`formatPlannerCalendarPresentation(projection, locale)`** — still pure functions, still no JSX.

Refinement from K-30.22: `labels` move out of `buildPlannerCalendarProjection` into presentation formatter.

### In core projection (locale-free)

| Field | Example |
| ----- | ------- |
| `dateKey` | `2026-06-12` |
| `sortKey` | `2026-06-12T14:00` |
| `daysUntil` | `-3`, `0`, `7` |
| `spanPosition` | `middle` |
| `title` | Note title as stored |
| `startTime` / `endTime` | `14:00` (24h structural) |
| `weekday` | `0`–`6` numeric |
| `isToday` | boolean |

### In presentation layer

| Field | Formatter |
| ----- | --------- |
| Month title | `formatPlannerMonthTitle(year, month, locale)` |
| Week range label | `formatPlannerWeekRange(start, end, locale)` |
| Day header | `formatPlannerDayHeading(dateKey, locale)` |
| Weekday column headers | `formatPlannerWeekdayShort(weekday, locale)` |
| Countdown label | `formatPlannerCountdown(daysUntil, locale)` → D-7 / D-Day / D+3 |
| Agenda date group header | `formatPlannerAgendaDateHeader(dateKey, locale)` |
| Quarter (if needed) | `formatPlannerQuarter(year, q, locale)` |

### Static UI copy

Button labels, section titles (`Routines`, `Todos`) — existing `i18n.ts` / `useTranslation()` in components. Not projection concern.

### Locale resolver

```typescript
function resolvePlannerLocale(language: AppSettings['language']): PlannerLocale {
  return language === 'ko' ? 'ko' : language === 'ja' ? 'ja' : 'en';
}
```

Pass to presentation formatter only — not to `buildPlannerCalendarProjection`.

---

## Performance Considerations

### Scale assumptions

| Input | Typical scale | Worst case |
| ----- | ------------- | ---------- |
| Notes vault | 500–5,000 | 20,000+ |
| Event notes | 10–200 | 1,000+ |
| Schedule blocks / day | 0–10 | 30 |
| Projection range | 1–42 days | 14 (Agenda) / 42 (month pad) |

### Complexity targets

| Stage | Target |
| ----- | ------ |
| Event catalog build | O(notes) — cacheable |
| Occurrence expansion | O(events × daysInSpan) clipped to range |
| `byDate` index | O(rangeDays + blocks + todos + routines) |
| View derivation | O(rangeDays) or O(rangeDays log rangeDays) for agenda sort |
| **Total per navigation** | **< 5ms** for 5k notes on modern client (test budget) |

### Single-pass opportunities

| Merge | Benefit |
| ----- | ------- |
| Events + milestones in one note scan | One vault iteration |
| Group blocks/todos/routines by date while normalizing | Avoid three extra passes |
| Finalize `hints` while building bundle | No second day loop |

### Caching (hook layer, not projection)

```typescript
const eventCatalog = useMemo(
  () => buildPlannerEventCatalog(notes),
  [notes],
);

const projection = useMemo(
  () => buildPlannerCalendarProjection({ ...input, eventCatalog }),
  [eventCatalog, scheduleBlocks, anchorDate, viewMode, ...],
);
```

Projection functions stay pure — memoization in `usePlannerCalendarProjection` hook.

### Multi-year events

Long spans (e.g. 90-day sprint) clipped to projection range — only visible cells get occurrences. Full span metadata stays on `PlannerEventDefinition.endDate` for Month overflow messaging.

### Repeated navigation

Changing `anchorDate` within same month: reuse `eventCatalog`, refetch only schedule/todo/routine delta for new range. Changing month: new range, same catalog.

### Range caps

| View | Max days in `byDate` |
| ---- | -------------------- |
| Day | 1 (+ prior day fetch for carry-over metadata only) |
| Week | 7 |
| Month | ≤ 42 (6-row grid) |
| Agenda | 14 |

Never project 366-day windows in Calendar — unlike Note Range Trace.

---

## Future UI Compatibility

### Stable contract

Calendar UI components depend only on:

```typescript
type PlannerCalendarViewProps = {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  viewMode: PlannerCalendarViewMode;
  onNavigate: (next: { anchorDate?: string; viewMode?: PlannerCalendarViewMode }) => void;
};
```

Adding a fifth view mode (e.g. `year`) would extend `PlannerCalendarViewMode` and add a fifth key to `views` — not reshape existing payloads.

### View component mapping

| UI | Consumes |
| -- | -------- |
| `PlannerCalendarMonth` | `projection.views.month` + `presentation.month` |
| `PlannerCalendarWeek` | `projection.views.week` + `presentation.week` |
| `PlannerCalendarDay` | `projection.views.day` + `presentation.day` |
| `PlannerCalendarAgenda` | `projection.views.agenda` + `presentation.agenda` |

### Interaction refs

Every rendered item carries `sourceRef`:

| kind | `sourceRef` |
| ---- | ----------- |
| Event | `{ type: 'note', id: noteId }` |
| Block | `{ type: 'schedule', id: blockId }` |
| Todo | `{ type: 'todo', id: todoId }` |
| Countdown (legacy) | `{ type: 'legacy-dday', id }` |

UI routes taps to existing Note / Planner modals without projection knowing handlers.

### D-Day migration compatibility

`core.countdowns` entries include `source: 'note-event' | 'legacy-dday'`. When legacy removed, drop field value — shape unchanged.

---

## Recommended Direction

### What `buildPlannerCalendarProjection()` looks like

```typescript
function buildPlannerCalendarProjection(
  input: PlannerCalendarProjectionInput,
): PlannerCalendarProjection {
  const range = resolvePlannerCalendarRange(input.viewMode, input.anchorDate);

  const catalog = input.eventCatalog ?? buildPlannerEventCatalog(input.notes);
  const eventOccurrences = expandEventOccurrences(catalog, range);
  const milestones = buildPlannerMilestoneRows(input.notes, range);
  const scheduleBlocks = normalizeScheduleBlocks(input.scheduleBlocks, range);
  const weeklySlots = normalizeWeeklySlots(input.weeklySchedules);
  const countdowns = buildPlannerCountdowns(
    catalog.definitions,
    input.legacyDdays,
    input.now,
  );

  const byDate = buildPlannerByDateIndex({
    range,
    eventOccurrences,
    milestones,
    scheduleBlocks,
    weeklySlots,
    todos: input.todos,
    routines: input.routines,
    routineExceptionDates: input.routineExceptionDates,
    now: input.now,
  });

  const core: PlannerCalendarCore = {
    eventOccurrences,
    milestones,
    scheduleBlocks,
    weeklySlots,
    countdowns,
    eventsByNoteId: catalog.byNoteId,
    blocksById: indexBlocksById(scheduleBlocks),
  };

  const views = buildPlannerViewPayloads({
    viewMode: input.viewMode,
    anchorDate: input.anchorDate,
    range,
    byDate,
    core,
    now: input.now,
  });

  return {
    meta: {
      viewMode: input.viewMode,
      anchorDate: input.anchorDate,
      range,
      generatedAt: input.now.toISO() ?? new Date().toISOString(),
    },
    core,
    byDate,
    views,
  };
}
```

### Architecture that avoids redesign

| Decision | Rationale |
| -------- | --------- |
| **`byDate` canonical index** | All four views derive from one structure |
| **Occurrence expansion separate from catalog** | Cache catalog across navigations |
| **Core vs presentation split** | Locale changes don’t invalidate projection |
| **Four stable view keys** | UI modes swap without API churn |
| **Shared dateRangeUtils** | One expansion algorithm with Archive |
| **No Range Trace loop** | Correct multi-day + performant |

---

## Migration Path

| Phase | Milestone | Deliverable |
| ----- | --------- | ----------- |
| **0** | **K-30.23 (this doc)** | Projection architecture locked |
| **1** | K-30.24 | Extract `dateRangeUtils.ts`; move `enumerateClippedDateKeys` |
| **2** | K-30.25 | `plannerCalendarModels.ts` + `buildPlannerEventCatalog` + expansion tests |
| **3** | K-30.26 | `buildPlannerByDateIndex` + `buildPlannerCalendarProjection` + fixture tests |
| **4** | K-30.27 | `formatPlannerCalendarPresentation` + en/ko/ja label tests |
| **5** | K-30.28 | `usePlannerCalendarProjection` hook + data adapter |
| **6** | K-30.29+ | Calendar UI (Month + Day first) consuming stable shape |

**Test fixtures must cover:** single-day exam, 3-day travel, timed meeting, block overlap same day, legacy D-Day dedupe, empty vault, exception day banner.

---

## Risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| Per-day `buildDailyTraceProjection` copied | High | Explicit anti-pattern in this doc + code review |
| K-30.22 locale-in-projection drift | Medium | Core/presentation split documented here |
| `enumerateClippedDateKeys` duplicated again | Medium | Shared `dateRangeUtils` in K-30.24 |
| Month grid Sun vs Mon start split | Medium | Standardize Mon-start; document in month payload |
| Adapter N+1 daily fetches for week | Medium | Range API or parallel SWR later; projection shape unchanged |
| Over-eager view payload build | Low | Lazy inactive views allowed; keys stable |
| Countdown duplicate (Event + D-Day) | Medium | Dedupe in `buildPlannerCountdowns` |
| Large vault catalog rebuild | Low | `eventCatalog` memo in hook |
| Carry-over blocks wrong day | Medium | Explicit prior-day lookup in Day payload builder |

---

## Relationship to Prior Milestones

| Milestone | Relationship |
| --------- | -------------- |
| K-30.22 | Defines *what* views show — this doc defines *how* to build it |
| K-30.21 | Dual-layer primitives — projection respects Event vs block separation |
| K-30.20 | Weekly template input — `weeklySchedules` in adapter |
| K-30.16 / Archive | Indexing pattern donor — not output merger |
| K-28 | Event parse layer — authoritative |

---

## Decision Record

| Question | Decision |
| -------- | -------- |
| What does `buildPlannerCalendarProjection` do? | Range → normalize → expand → index → view payloads |
| Output shape? | `{ meta, core, byDate, views: { month, week, day, agenda } }` |
| Locale in projection? | **No** — presentation formatter sibling |
| Multi-day events? | `enumerateClippedDateKeys` + `PlannerEventOccurrence` per day |
| Primary index? | `byDate: Map<string, PlannerDayBundle>` |
| Reuse Range Trace loop? | **No** |
| Reuse Note mark enumeration? | **Yes** — extract shared util |
| Performance? | Event catalog cache + single-pass index + range caps |
| UI compatibility? | Stable four view keys + `sourceRef` on items |
| Implement now? | **No** |

---

*K-30.23 — architecture only. Next execution: shared date utils + projection module (K-30.24–K-30.26).*
