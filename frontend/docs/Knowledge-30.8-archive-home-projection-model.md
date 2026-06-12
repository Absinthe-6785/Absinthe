# Knowledge-30.8 — Archive Home Projection Model

## Scope

Data architecture only. **No UI, no tab rename, no component implementation.**

Builds on [K-30.5](./Knowledge-30.5-archive-identity.md) · [K-30.6](./Knowledge-30.6-archive-information-architecture.md) · [K-30.7](./Knowledge-30.7-archive-home-architecture.md).

**Success criterion:** Future Archive Home UI is **mostly rendering** — business logic lives in pure projection functions with explicit inputs and outputs.

---

## Executive Summary

Archive Home consumes a single **`ArchiveHomeProjection`** assembled by **`buildArchiveHomeProjection(input)`**.

| Section | Projection function | Primary sources |
| ------- | ------------------- | --------------- |
| Mark calendar | `buildArchiveMarkCalendarProjection` | Note daily traces + domain mark feed |
| Recent milestones | `buildArchiveRecentMilestones` | Note `milestoneDate` / `milestoneLabel` |
| Area pills | `buildArchiveAreaPills` | Area notes + backlink activity window |
| You are here | `buildArchiveYouAreHere` | Clock `now` (pure calendar) |
| Browse | `buildArchiveBrowseLinks` | Derived from `now` + optional mark years |

**Mark model:** A **mark** is evidence that something left a trace on a calendar day. Mark **types are preserved** in the data model; **density** for the calendar is the **count of distinct mark types present** that day (aligned with K-30.3 `getMarkLevel` — not a productivity score).

---

## Core Question Answers

### What data does Archive Home need?

1. **Per-day mark index** — multi-year, cross-domain, type-tagged
2. **Global milestone list** — sorted by date, capped for Home
3. **Area activity summary** — which areas had marks in lookback window
4. **Calendar anchor** — current year / quarter / month
5. **Browse targets** — period scopes as navigation refs

### Where does it come from?

| Data | Source today | Future |
| ---- | ------------ | ------ |
| Note milestones, events, activity | `NoteBase[]` in client store | Same — `buildDailyTraceProjection` |
| Workout / routine / study / exception | `/api/heatmap` (112 days) | **`/api/archive_marks`** or extended heatmap (multi-year) |
| Areas | `listAreaNotes(notes)` + backlink index | Same |
| Now | `DateTime` / `Date` from app shell | Same |

### How should it be projected?

**Pure functions** in `frontend/src/components/views/features/knowledge/archive/` (proposed path — not implemented in K-30.8):

```
buildArchiveHomeProjection(input)
  ├── buildArchiveYouAreHere(now)
  ├── buildArchiveMarkCalendarProjection(notes, domainMarks, options)
  ├── buildArchiveRecentMilestones(notes, options)
  ├── buildArchiveAreaPills(notes, markCalendar | activity index, options)
  └── buildArchiveBrowseLinks(now, markCalendar)
```

---

## ArchiveHomeProjection

### Top-level shape

```typescript
/** Computed — not persisted. Archive Home read model. */
export interface ArchiveHomeProjection {
  /** Identity frame for UI — static copy + generated anchor date */
  frame: ArchiveHomeFrame;

  /** Calendar position anchor (K-30.7 compact "You are here") */
  youAreHere: ArchiveYouAreHere;

  /** Multi-year mark field — signature Home widget */
  markCalendar: ArchiveMarkCalendarProjection;

  /** Recent transitions — 3–5 items (K-30.7) */
  recentMilestones: readonly ArchiveMilestoneEntry[];

  /** Concern entry points — ordered by recent activity */
  areaPills: readonly ArchiveAreaPill[];

  /** Period / area navigation shortcuts */
  browse: ArchiveBrowseProjection;

  /** Sparse-data hints — no fake marks */
  empty: ArchiveHomeEmptyFlags;
}
```

### Input bundle

```typescript
export interface ArchiveHomeProjectionInput {
  /** Active notes vault — same as NoteView */
  notes: readonly NoteBase[];

  /** Current instant — local calendar derived from this */
  now: Date;

  /** Domain marks by day — from API (see Data Sources) */
  domainMarks: readonly ArchiveDomainMarkDay[];

  /** Optional overrides */
  options?: ArchiveHomeProjectionOptions;
}

export interface ArchiveHomeProjectionOptions {
  /** Mark calendar span ending at `now` — default 5 years */
  calendarYears?: number;

  /** Recent milestone cap — default 5 */
  recentMilestoneLimit?: number;

  /** Area pill lookback — default 24 months */
  areaLookbackMonths?: number;

  /** Max area pills on Home — default 8 */
  areaPillLimit?: number;

  /** Locale for labels — default app locale */
  locale?: string;
}
```

### Orchestrator

```typescript
/**
 * Pure aggregation for Archive Home.
 * No scores, streaks, or evaluative fields.
 */
export function buildArchiveHomeProjection(
  input: ArchiveHomeProjectionInput,
): ArchiveHomeProjection;
```

**Boundaries:**

| Inside projection | Outside (UI / hooks) |
| ----------------- | -------------------- |
| Merge note + domain marks | Fetch `domainMarks` via SWR |
| Sort, cap, filter | Tab routing, click handlers |
| Date math from `now` | `formatDate` display helpers |
| Empty flags | Copy strings (i18n) |

---

## Section Projections

### 1. Mark Calendar

#### Purpose

Visualize **continuity across years** — days that left marks, without ranking the user.

#### What counts as a mark?

A calendar day has a mark when **any** of the following is true:

| Mark type | Source | Detection |
| --------- | ------ | --------- |
| `note-activity` | Note | `buildDailyTraceProjection(date).activities.length > 0` |
| `milestone` | Note | Milestone with `milestoneDate === date` |
| `event` | Note | Event with `eventDate === date` (or spans date) |
| `workout` | Health API | `workout_count > 0` |
| `routine` | Planner API | `routine_done > 0` |
| `scheduled-study` | Planner API | `study_mins > 0` (schedule block, not grade) |
| `exception` | Planner API | `is_exception === true` — context mark, not failure |

**Excluded from marks:** todos incomplete, future schedules, protein goals, PR records, routine *misses*, percent completion.

#### Should all marks be equal?

**In storage: yes — each type is tagged.**
**In density display: equal weight per type present.**

Density level (0–3+) = **count of distinct mark types** on that day (excluding `exception` from density count but showing distinct cell styling). Matches K-30.3 philosophy:

```typescript
function computeMarkDensity(types: readonly ArchiveMarkType[]): number {
  const countable = types.filter(t => t !== 'exception');
  return countable.length;
}
```

Optional future: UI legend shows **which** types contributed (tooltip), not **how well**.

#### Types

```typescript
export type ArchiveMarkType =
  | 'note-activity'
  | 'milestone'
  | 'event'
  | 'workout'
  | 'routine'
  | 'scheduled-study'
  | 'exception';

export interface ArchiveMarkDay {
  date: string; // YYYY-MM-DD
  types: readonly ArchiveMarkType[];
  density: number; // distinct types (exception excluded from density)
}

export interface ArchiveMarkCalendarProjection {
  /** Inclusive start/end of rendered grid */
  startDate: string;
  endDate: string;

  /** Sparse or dense day index — only days with marks OR full grid (implementation choice) */
  days: readonly ArchiveMarkDay[];

  /** Year boundaries for column labels */
  years: readonly number[];

  /** Month labels for navigation jumps */
  monthLabels: readonly ArchiveMonthLabel[];

  /** Precomputed weeks grid for UI (optional convenience) */
  weeks?: readonly (readonly string[])[];

  hasAnyMarks: boolean;
}

export interface ArchiveMonthLabel {
  year: number;
  month: number; // 1–12
  label: string; // localized
  weekIndex: number;
}
```

#### Builder

```typescript
export function buildArchiveMarkCalendarProjection(
  notes: readonly NoteBase[],
  domainMarks: readonly ArchiveDomainMarkDay[],
  options: { now: Date; calendarYears?: number },
): ArchiveMarkCalendarProjection;
```

#### Note-side algorithm (reuse)

1. Determine `[startDate, endDate]` — `now` minus `calendarYears` (default 5).
2. **Single-pass note scan** (preferred over 365×N daily builds):
   - Collect all milestone dates → type `milestone`
   - Collect all event dates (incl. ranges) → type `event`
   - Collect activity days via same rules as `resolveActivityKind` in `buildDailyTraceProjection.ts`
3. Merge with `domainMarks` by date → union types → compute density.

**Reuse:** `buildDailyTraceProjection` for **validation/tests** and **single-day drill-down**; range scan for Home performance.

#### Domain feed

```typescript
/** One row from API — aligns with current heatmap + extensions */
export interface ArchiveDomainMarkDay {
  date: string;
  workout_count: number;
  routine_done: number;
  routine_total: number;
  study_mins: number;
  is_exception: boolean;
}

export function domainMarkDayToTypes(day: ArchiveDomainMarkDay): ArchiveMarkType[] {
  const types: ArchiveMarkType[] = [];
  if (day.workout_count > 0) types.push('workout');
  if (day.routine_done > 0) types.push('routine');
  if (day.study_mins > 0) types.push('scheduled-study');
  if (day.is_exception) types.push('exception');
  return types;
}
```

---

### 2. Recent Milestones

#### Purpose

Show **transitions** — chapter headings in personal history.

#### How many?

**Default: 5** (K-30.7). Configurable via `recentMilestoneLimit`. Minimum display 0; never pad with placeholders.

Alternative windows:

| Strategy | Use |
| -------- | --- |
| **Last N by date** (recommended) | Global recent transitions |
| Last 12 months filter | Optional stricter window — not default |

**Not 10 on Home** — overflows first screen; full list lives in Period view.

#### Source fields

| Property | Key | Required |
| -------- | --- | -------- |
| Date | `milestoneDate` | Yes |
| Label | `milestoneLabel` | No — fallback `note.title` |
| Kind | `milestoneKind` | No — **remain optional** |

**Recommendation on kind:** Keep `milestoneKind` **optional and minimal**. Do not introduce enum ceremony in K-30.8. Display label + date only on Home; kind available for future filtering/icons.

#### Projection shape

```typescript
/** Home row — extends trace ref with navigation targets */
export interface ArchiveMilestoneEntry extends TraceMilestoneRef {
  /** Display title — label ?? note title */
  displayLabel: string;

  /** Period scope containing this milestone — for navigation */
  periodRef: ArchivePeriodRef;

  /** Optional area ids linked via backlinks (for area chip) */
  areaNoteIds?: readonly string[];
}

export function buildArchiveRecentMilestones(
  notes: readonly NoteBase[],
  options?: { limit?: number; now?: Date },
): ArchiveMilestoneEntry[];
```

#### Algorithm (reuse)

1. Filter active notes: `isMilestoneNote(note)` (`milestoneNotes.ts`)
2. Map via `readMilestoneFromNote` → `TraceMilestoneRef` (same as `buildAreaMilestoneRef` pattern)
3. Sort by `date` descending, tie-break `displayLabel`
4. Take first `limit`
5. Attach `periodRef` from milestone date (year / quarter / month)

**Reuse:** `isMilestoneNote`, `readMilestoneFromNote`, `TraceMilestoneRef` from K-28.

**Do not reuse:** `buildRangeTraceProjection` for Home — over-scans date range; single-pass milestone collect is O(notes).

---

### 3. Area Pills

#### Purpose

Concern-oriented **entry points** into Area Archive branch.

#### Activity model

**Recommended:** Marks during **last 24 months** (K-30.7).

| Mark counts toward area activity | Yes / No |
| -------------------------------- | -------- |
| Linked note activity on date | Yes |
| Milestone on linked note | Yes |
| Event on linked note | Yes |
| Milestone/event on area note itself | Yes |
| Workout / routine (no note link) | **No** — unless future `[[Exercise]]` area convention |
| Lifetime with no recent marks | Hidden from Home pills |

**Alternative (lifetime):** Include areas with any historical mark — surfaces dormant areas. **Rejected for Home** — clutters pills; "All areas →" covers lifetime.

#### Projection shape

```typescript
export interface ArchiveAreaPill {
  areaNoteId: string;
  title: string;

  /** Marks in lookback window — for sort order only, not displayed as score */
  markCount: number;

  /** Most recent mark date in window */
  lastMarkDate: string | null;

  /** Navigation target */
  areaRef: ArchiveAreaRef;
}

export function buildArchiveAreaPills(
  notes: readonly NoteBase[],
  options: { now: Date; lookbackMonths?: number; limit?: number },
): ArchiveAreaPill[];
```

#### Algorithm (reuse)

1. `listAreaNotes(notes)` (`areaNotes.ts`)
2. For each area: `resolveAreaMembership(areaId, notes)` (`buildAreaTraceProjection.ts`)
3. For each member note, collect mark dates in `[lookbackStart, now]`:
   - Milestone dates, event dates
   - Activity days (created/edited per `resolveActivityKind` rules)
4. `markCount` = unique dates with any mark (not note count)
5. Sort: `lastMarkDate` desc, then `title`
6. Take `limit` (default 8)

**Reuse:** `listAreaNotes`, `resolveAreaMembership`, `isMilestoneNote`, `isEventNote`, activity date rules from daily trace.

**Optional optimization:** Derive from pre-built `ArchiveMarkDay[]` + backlink index if calendar already computed — K-30.9 implementation detail.

---

### 4. You Are Here

#### Purpose

Anchor the user in **calendar time** — "where now sits in the archive."

#### Representation

**Pure date anchor** — not active UI scope, not last visited period.

```typescript
export interface ArchiveYouAreHere {
  /** ISO date key for today (local) */
  today: string;

  year: number;
  quarter: 1 | 2 | 3 | 4;
  month: number; // 1–12

  /** Localized display segments */
  labels: {
    year: string;
    quarter: string;   // e.g. "Q2"
    month: string;     // e.g. "June"
    combined: string;  // e.g. "2026 · Q2 · June"
  };

  /** Default period drill-down from "Open this period" */
  openPeriod: ArchivePeriodRef;
}
```

#### Derivation

```typescript
export function buildArchiveYouAreHere(now: Date, locale?: string): ArchiveYouAreHere;
```

**Reuse:** `currentTraceMonth`, `currentTraceQuarter`, `currentTraceYear`, `toDateKey` from `buildRangeTraceProjection.ts` / `parseDatabaseDate`.

**Not included:** `activeTab`, `workspaceActivation`, last Archive navigation — UI session state stays in React.

---

### 5. Browse Section

#### Purpose

Entry into **Period**, **Area index**, and **Custom** navigation.

#### Static vs derived

| Link | Type | Source |
| ---- | ---- | ------ |
| This Year | **Derived** | `currentTraceYear(now)` |
| This Quarter | **Derived** | `currentTraceQuarter(now)` |
| This Month | **Derived** | `currentTraceMonth(now)` |
| Custom | **Static** ref | Opens custom range picker — no projection data |
| All areas | **Static** ref | Area index route |
| Timeline | **Static** ref | Timeline with default scope = current month or year |

**Optional derived:** **Recent years with marks** — from `markCalendar.years` where `hasAnyMarks`:

```typescript
recentPeriods?: readonly ArchivePeriodRef[]; // e.g. last 3 years with marks
```

Not pinned periods in K-30.8 — user pins deferred.

#### Projection shape

```typescript
export type ArchivePeriodKind = 'year' | 'quarter' | 'month' | 'custom' | 'day';

export interface ArchivePeriodRef {
  kind: ArchivePeriodKind;
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  month?: number;
  startDate?: string;
  endDate?: string;
  label: string;
}

export interface ArchiveAreaRef {
  areaNoteId: string;
  title: string;
}

export interface ArchiveBrowseProjection {
  thisYear: ArchivePeriodRef;
  thisQuarter: ArchivePeriodRef;
  thisMonth: ArchivePeriodRef;
  custom: { kind: 'custom'; label: string };
  allAreas: { kind: 'areas-index'; label: string };
  timeline: { kind: 'timeline'; defaultPeriod: ArchivePeriodRef; label: string };

  /** Optional — years with marks, newest first */
  recentYearsWithMarks?: readonly ArchivePeriodRef[];
}

export function buildArchiveBrowseLinks(
  now: Date,
  markCalendar?: ArchiveMarkCalendarProjection,
  locale?: string,
): ArchiveBrowseProjection;
```

**Reuse:** `TraceRangeLens` kinds map 1:1 to `ArchivePeriodRef` — conversion helpers bridge Note period lenses and Archive navigation.

```typescript
export function archivePeriodRefToTraceRangeLens(ref: ArchivePeriodRef): TraceRangeLens | null;
```

---

## Shared Navigation Types

```typescript
export interface ArchiveHomeFrame {
  title: 'Archive';
  subtitle: 'What remains when you look back.';
  generatedAt: string; // ISO timestamp — for debugging, not UI clock
}

export interface ArchiveHomeEmptyFlags {
  noMarks: boolean;
  noMilestones: boolean;
  noAreas: boolean;
  /** True when entire vault empty of archive-eligible data */
  isEmpty: boolean;
}
```

---

## Data Sources

### Client-side (notes vault)

| Field / concept | Origin |
| --------------- | ------ |
| Milestones | `Note.properties.milestoneDate`, `milestoneLabel`, optional `milestoneKind` |
| Events | `Note.properties` via `eventNotes.ts` |
| Activity | `createdAt`, `updatedAt`, optional `traceDate` |
| Areas | `type=area` + wiki backlinks |

### API (domain marks)

| Endpoint today | Limitation | K-30.8+ need |
| -------------- | ---------- | ------------ |
| `GET /api/heatmap` | 112 days (16 weeks) | **Multi-year** domain marks |

**Recommended new endpoint (future implementation):**

```
GET /api/archive_marks?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
→ ArchiveDomainMarkDay[]
```

Same shape as heatmap row — extend backend `get_heatmap` date range parameterization. **K-30.8 documents contract only.**

### Hook layer (future — not K-30.8)

```typescript
// Pseudocode — lives outside pure projection
function useArchiveHomeProjection(notes: NoteBase[], now: Date) {
  const { start, end } = archiveCalendarBounds(now, 5);
  const { data: domainMarks } = useSWR(`/api/archive_marks?start_date=${start}&end_date=${end}`);
  return useMemo(
    () => buildArchiveHomeProjection({ notes, now, domainMarks: domainMarks ?? [] }),
    [notes, now, domainMarks],
  );
}
```

---

## Reuse Opportunities

### K-28 Trace (existing)

| Asset | Reuse in Archive Home |
| ----- | --------------------- |
| `buildDailyTraceProjection` | Activity + milestone + event per day; tests; day drill-down |
| `buildRangeTraceProjection` | Period branch (not Home); `enumerateDateKeys` |
| `TraceMilestoneRef`, `TraceEventRef` | Milestone/event entries |
| `TRACE_PROPERTY_KEYS` | Single convention |
| `milestoneNotes.ts` | `isMilestoneNote`, `readMilestoneFromNote` |
| `eventNotes.ts` | `isEventNote`, `readEventFromNote` |
| `rangeTraceModels.ts` | `TraceRangeLens` ↔ `ArchivePeriodRef` |
| `dailyTraceDayHelpers.ts` | Date shift helpers for calendar |

### K-29 Areas (existing)

| Asset | Reuse |
| ----- | ----- |
| `listAreaNotes` | Area pill candidates |
| `resolveAreaMembership` | Mark counting per area |
| `buildAreaTraceProjection` | Area **branch** depth — not Home pills directly |
| `buildAreaRangeTraceProjection` | Area × period branch |

### K-30 Archive docs

| Doc | Projection alignment |
| --- | -------------------- |
| K-30.7 | Section list, caps (5 milestones, 8 areas, 5 years) |
| K-30.6 | Period / Area / Timeline refs in entries |
| K-30.3 | Mark density algorithm |
| K-30.5 | Exclusion rules (no PR, no streaks) |

### AnalyticsView (interim)

| Current | Maps to |
| ------- | ------- |
| `getMarkLevel` / `HeatmapDay` | `ArchiveMarkDay.density` from domain types |
| `weeklyReview` aggregates | **Not on Home** — Period branch only |
| `heatmapData` SWR | `domainMarks` input (extend range) |

---

## New Requirements

| Requirement | Priority | Notes |
| ----------- | -------- | ----- |
| `buildArchiveHomeProjection` orchestrator | P0 | Single Home read model |
| Single-pass note mark index builder | P0 | Performance for 5-year calendar |
| `ArchiveDomainMarkDay` API extension | P0 | Multi-year domain marks |
| `archivePeriodRefToTraceRangeLens` | P1 | Deep link Note ↔ Archive |
| Area mark counting in window | P1 | 24-month lookback |
| `weeks` grid precompute in projection | P2 | UI convenience |
| Milestone → area backlink resolution | P2 | Optional chips on milestone rows |
| `recentYearsWithMarks` in browse | P2 | Derived from calendar |
| Persist last Archive scope | **Out** | UI session — not projection |

### Explicit non-requirements

- Productivity scores, streaks, completion rates
- Weekly timetable data in projection
- Note body text in projection
- Graph / discover patterns on Home
- Server-side projection persistence

---

## Recommended API Summary

### File layout (proposed)

```
frontend/src/components/views/features/knowledge/archive/
├── archiveHomeModels.ts          // types
├── buildArchiveYouAreHere.ts
├── buildArchiveMarkCalendar.ts   // note scan + domain merge
├── buildArchiveRecentMilestones.ts
├── buildArchiveAreaPills.ts
├── buildArchiveBrowseLinks.ts
├── buildArchiveHomeProjection.ts // orchestrator
├── archiveHomeProjection.test.ts
└── index.ts
```

### Public exports

```typescript
export {
  buildArchiveHomeProjection,
  buildArchiveMarkCalendarProjection,
  buildArchiveRecentMilestones,
  buildArchiveAreaPills,
  buildArchiveYouAreHere,
  buildArchiveBrowseLinks,
  archivePeriodRefToTraceRangeLens,
  domainMarkDayToTypes,
} from './...';

export type {
  ArchiveHomeProjection,
  ArchiveHomeProjectionInput,
  ArchiveMarkCalendarProjection,
  ArchiveMarkDay,
  ArchiveMarkType,
  ArchiveMilestoneEntry,
  ArchiveAreaPill,
  ArchiveYouAreHere,
  ArchiveBrowseProjection,
  ArchivePeriodRef,
  ArchiveDomainMarkDay,
} from './archiveHomeModels';
```

### Test strategy (future)

| Test | Assert |
| ---- | ------ |
| Empty vault | `empty.isEmpty`, no fake marks |
| Milestone sort | Newest first, limit 5 |
| Mark merge | Note + domain types union correctly |
| Density | 3 types → density 3, not weighted by routine % |
| Area pills | Dormant area excluded in 24mo window |
| You are here | Quarter/month match local `now` |

**Reuse test patterns from:** `dailyTrace.test.ts`, `areaTrace.test.ts`, `rangeTrace.test.ts`.

---

## UI Mapping (reference only — not implemented)

| `ArchiveHomeProjection` field | K-30.7 UI section |
| ----------------------------- | ----------------- |
| `frame` | Title + subtitle |
| `markCalendar` | Mark calendar widget |
| `youAreHere` | Compact orient line |
| `recentMilestones` | Recent transitions list |
| `areaPills` | Concern pills |
| `browse` | Browse chip row |

Rendering reads fields **directly** — no secondary aggregation in components.

---

## Relationship to Prior Milestones

| Milestone | K-30.8 relationship |
| --------- | ------------------- |
| K-30.7 | Home sections → projection fields 1:1 |
| K-30.6 | Period/Area/Timeline refs in navigation types |
| K-30.5 | Mark inclusion rules enforce archive principles |
| K-30.4 | Superseded elimination — Archive tab justified with explicit data model |
| K-28 / K-29 | Maximum reuse of trace + area projections |

---

*K-30.8 — data architecture only. `buildArchiveHomeProjection` is the contract; UI renders it.*
