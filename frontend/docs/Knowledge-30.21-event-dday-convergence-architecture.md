# Knowledge-30.21 — Event and D-Day Convergence Architecture

## Scope

Architecture and product direction only. **No implementation, no Planner redesign, no Calendar UI, no Event note changes, no D-Day code changes.**

Builds on K-30.17 (Planner / Event / Calendar direction), K-30.18 (widget redistribution), K-30.19 (legacy Analytics cleanup), and K-30.20 (Weekly Timetable → Planner).

**Problem:** Planning data is split across two storage systems (Note properties vs Supabase schedules) with overlapping concepts — especially **D-Day** (Planner) and **Event** (Note). Calendar work cannot start until the primitives are defined.

**Success questions this document answers:**

1. *What should be the central planning primitive in Absinthe?*
2. *If Calendar is built later, what data model should it consume?*

---

## Executive Summary

Absinthe should **not** pick a single entity for all planning. It should converge on a **dual-layer model**:

| Layer | Role | Central primitives |
| ----- | ---- | ------------------ |
| **Knowledge (Note-backed)** | *What happens when* — significant dated anchors and life transitions | **Event**, **Milestone** |
| **Operational (Supabase-backed)** | *How time is allocated and executed* — hour blocks, habits, daily checklists | **Schedule block**, **Weekly template**, **Routine**, **Todo** |

**D-Day should not survive as an independent primitive.** It should become a **presentation mode** over **Events** (Option B), with a read-only legacy fallback during migration.

**Calendar (future Planner landing)** should consume a **projection**, not raw stores:

```
buildPlannerCalendarProjection({
  notes,           → events, milestones (read-only)
  schedules,       → day blocks
  weeklySchedules, → week template overlay
  todos, routines, → day/agenda execution lists
  ddays,           → legacy countdown (transitional)
  date, locale,
})
```

---

## Existing Concept Audit

Inventory from current code: `PlannerView.tsx`, `useDailyData`, `useStaticData`, `eventNotes.ts`, `milestoneNotes.ts`, `WeeklyTimetableSection.tsx`, `buildNoteMarkIndex.ts`.

### Summary table

| Concept | Purpose | Time scope | Current owner | Overlap | Future relevance |
| ------- | ------- | ---------- | ------------- | ------- | ---------------- |
| **D-Day** | Countdown to a significant date (exam, deadline, trip) | Single future/past date; all-day | **Planner** — `GET /api/schedules/ddays` (`is_dday: true` rows) | **Event notes** (same job); schedule modal also has `is_dday` checkbox | **Merge → Event**; countdown UI reads Events |
| **Event (note)** | Significant occurrence — exam, meeting, travel, deadline | Day → multi-day range; optional `HH:mm` | **Note** (capture/edit); **Archive** (mark index) | D-Day; Milestone on same note allowed | **Primary dated anchor**; Planner Calendar consumes projection |
| **Milestone (note)** | Phase transition — “what changed” (passed exam, started job) | Single date point | **Note**; **Archive Home** (Recent Transitions) | Event (coexist on note); not a countdown | **Keep separate** — retrospective, not operational planning |
| **Weekly schedule** | Recurring weekly time template (Mon 9–10 Study) | Repeating weekday + time window | **Planner** — `WeeklyTimetableSection` (K-30.20) | Daily Timeline blocks (template vs instance) | **Keep** — Week view overlay |
| **Timeline / Schedule block** | Hour-level allocation on selected day | Single day, 30-min grid (`00:00–23:30`) | **Planner** — `useDailyData` → `GET /api/schedules?date=` | Events (occurrence vs allocation); weekly template | **Keep** — becomes **Day** mode in Calendar |
| **Routine** | Daily habit execution + mark | Daily checklist + `routine_logs` | **Planner**; Archive mark density via heatmap API | Weekly template (both recurring, different UX) | **Keep** — Day sidebar, not month grid primary |
| **Todo (Planner API)** | Lightweight same-day task checklist | Date-scoped via `/api/todos?date=` | **Planner** | Note **task templates** (`dueDate`, `status`) — parallel, no sync | **Secondary** — optional bridge to note tasks later |
| **Task (note template)** | Structured task note in vault | Property `dueDate` (convention) | **Note / Workspace** — not in Planner | Planner Todos | **Secondary capture path** — not Calendar-central today |

### D-Day (detail)

**Storage:** `Schedule` row with `is_dday: true`, dummy `start_time`/`end_time` `00:00`, fetched as `DDay { id, text, date }` from `/api/schedules/ddays`.

**UI:** Planner column list with client-side `D-N` / `D-Day` / `D+N` via `calculateDday()`. CRUD via D-Day modal (`POST/PUT/DELETE /api/schedules`).

**Archive:** D-Days do **not** appear in `buildNoteMarkIndex` or Archive Home. Historical countdown dates live only in Supabase unless manually captured as Notes.

### Event note (detail)

**Property keys** (`dailyTraceModels.ts`):

```
type = 'event'
eventDate        (required)
eventTime        (optional)
eventEndDate     (optional range)
eventEndTime     (optional)
```

**Logic:** `eventNotes.ts`, UI: `EventNoteDialog.tsx`. Archive: `buildNoteMarkIndex` marks each day in range with type `event`.

**Strengths today:** Capture in Note → visible in trace lenses → Archive mark calendar. Supports multi-day ranges and optional times.

**Gaps today:** No Planner surface; no countdown widget; no link from Schedule blocks to Event notes.

### Milestone (detail)

**Property keys:** `milestoneDate`, `milestoneLabel`, `milestoneKind`.

**Semantic:** “Something **changed** on this date” — not “something **will happen**.” Archive Home surfaces recent milestones as **Recent transitions**.

**Coexistence:** A note may carry both Event and Milestone properties. Code does not enforce exclusivity.

### Weekly schedule (detail)

**Storage:** `WeeklySchedule { id, day, title, start_time, end_time, color }` — `GET /api/weekly_schedules`.

**Owner:** Planner only (since K-30.20). CRUD in `WeeklyTimetableSection`.

**Semantic:** **Template**, not a dated instance. Does not appear on Archive.

### Timeline / Schedule block (detail)

**Storage:** `Schedule { id, text, start_time, end_time, is_dday, color, category }` per date.

**UI:** 48-slot half-hour grid; supports `end_next_day` carry-over blocks.

**Semantic:** **Time allocation** — “I plan to use this slot for X,” not necessarily a world-facing event.

### Routine / Todo (detail)

**Routines:** Active list + per-day done state; exception days via `/api/routine_exceptions`.

**Todos:** Simple `{ text, done }` for selected date only.

Neither participates in Note mark index. Both belong on **Day** execution surface, not as Calendar month anchors.

### Task notes (detail)

Task templates (`taskTemplateRegistry.ts`) set properties: `status`, `priority`, `dueDate`, etc. Database views can bucket by `dueDate`.

**No bridge** to Planner Todos. Treat as **capture-layer tasks** until an explicit integration milestone.

---

## D-Day Evaluation

Three options for D-Day’s long-term fate.

### Option A — D-Day remains independent

| Advantages | Disadvantages |
| ---------- | ------------- |
| Zero migration cost | Permanent duplicate of Event semantics |
| Familiar Planner-only UX | D-Days invisible to Archive / Note trace |
| Simple countdown list | Two write paths for “TOEFL Aug 20” |
| | Calendar must merge two anchor sources forever |

**Verdict:** Reject as steady state. Acceptable **only** as a transitional read path.

### Option B — D-Day becomes a view of Events ✓ Recommended

Example presentation (not new storage):

```
Event note: "TOEFL"     eventDate: 2026-08-20  →  Planner shows D-120
Event note: "JLPT"      eventDate: 2026-07-01  →  Planner shows D-45
Event note: "Interview" eventDate: 2026-06-19  →  Planner shows D-7
```

| Advantages | Disadvantages |
| ---------- | ------------- |
| Single source of truth for dated anchors | Requires projection layer + Planner UI work |
| Capture in Note → Archive marks automatically | Users must learn Events replace D-Day **creation** |
| Countdown UX preserved in Planner Agenda | Legacy D-Day rows need migration or dual-read period |
| Aligns with K-28 trace philosophy | Event dialog lives in Note today — Planner needs “Add event” affordance that writes notes |

**Verdict:** **Recommended.** D-Day is a **display convention** (countdown from `eventDate` to today), not a separate entity.

### Option C — Remove D-Day entirely

| Advantages | Disadvantages |
| ---------- | ------------- |
| Simplest data model | Loses high-signal countdown UX unless replaced |
| No dual-read period | Users with existing D-Days lose Planner visibility without migration |
| | “Days until exam” is core Planner value — removal hurts daily use |

**Verdict:** Reject. Remove the **entity**, not the **UX**. Option B preserves UX without the entity.

### Recommendation

**Option B** with phased migration:

1. **Read:** Planner countdown / Agenda reads `buildPlannerEventProjection(notes)` **plus** legacy `ddays` (dedupe by date+title heuristic or explicit link table later).
2. **Write:** New significant dates created as **Event notes** (Note dialog or Planner shortcut that creates/updates a note).
3. **Deprecate:** D-Day modal and `/api/schedules/ddays` write path after migration window.

---

## Event Architecture

### Can Events become the primary dated object?

**Yes — for dated anchors. No — for the full planning model.**

| Question | Event as primary? |
| -------- | ----------------- |
| Exam on Aug 20 | **Yes** |
| Travel Jun 10–12 | **Yes** (range) |
| Application deadline | **Yes** |
| Meeting at 14:00 | **Yes** (with `eventTime`) |
| Study block 18:00–20:00 today | **No** — use Schedule block |
| Daily gym habit | **No** — use Routine |
| “Finish slides” today | **No** — use Todo (or note task) |
| “Passed N1” (transition) | **No** — use Milestone |

### Example mapping

| User language | Primitive | Storage |
| ------------- | --------- | ------- |
| TOEFL Exam · Aug 20 | Event | Note `eventDate` |
| Team standup · Mon 10:00 | Event or Schedule block | Event if note-worthy; block if operational slot |
| English study · 18:00–20:00 | Schedule block | Supabase schedule |
| Weekly Mon/Wed study template | Weekly schedule | Supabase `weekly_schedules` |
| Drink water daily | Routine | Supabase routine |
| Buy milk today | Todo | Supabase todo |

### Strengths of Event-as-anchor

- **Capture path:** Quick capture and Event dialog already in Note (K-28).
- **Archive path:** `buildNoteMarkIndex` already indexes multi-day events.
- **Range + time:** Richer than D-Day (single date, no time).
- **Trace integration:** Daily / range trace lenses already project events.
- **Long-horizon identity:** Events remain meaningful years later as historical context.

### Limitations (must not pretend Events solve)

| Limitation | Mitigation |
| ---------- | ---------- |
| No Planner CRUD today | Planner “Add event” opens Note event flow or inline note create |
| No hour-grid placement | Keep Schedule blocks for Day view |
| No recurring instances | Keep Weekly template; do not overload Event with RRULE yet |
| Milestone overlap on same note | Document: Event = forward occurrence; Milestone = transition marker |
| Countdown not implemented on Events | Add `daysUntil(eventDate)` in projection — same math as `calculateDday()` |

### Event vs Milestone (do not merge)

| | Event | Milestone |
| - | ----- | --------- |
| Question | What **will** / **did** happen? | What **changed**? |
| Planner forward use | **Yes** — Agenda, Month badges | Optional dot; primary home is Archive |
| Archive | Mark type `event` | Recent Transitions + mark type `milestone` |
| Example | “TOEFL Exam” on Aug 20 | “Passed TOEFL” on results day |

A single note *may* carry both (e.g. event note later marked with milestone on results day). UI should not require it.

---

## Schedule Architecture

### Core distinction

| | Event | Schedule |
| - | ----- | -------- |
| Definition | **Something happens** | **Time is allocated** |
| User intent | Commitment / occurrence | Plan how to spend time |
| Typical examples | Exam, flight, interview, wedding | Study session, deep work, lunch buffer |
| Storage | Note properties | Supabase `schedules` (dated) |
| Calendar mode | Month / Agenda | Day (grid) / Week |

**Example pair:**

```
Event:     TOEFL Exam          · 2026-08-20        (anchor)
Schedule:  English Study       · 18:00–20:00       (today’s allocation)
Weekly:    English Study       · Mon/Wed 18:00     (recurring template)
```

All three can coexist. They answer different questions.

### Should both survive?

**Yes.** Collapsing Schedule into Event would force every hour block into the vault — heavy capture friction. Collapsing Event into Schedule would trap significant dates in Supabase rows with no Note body, no Archive trace, no linking.

**Optional future link:** Schedule block metadata `linkedEventNoteId` — not required for Calendar v1.

### Weekly schedule vs daily schedule

| | Weekly template | Daily schedule block |
| - | --------------- | -------------------- |
| Scope | Repeating weekday pattern | Specific calendar date |
| Table | `weekly_schedules` | `schedules` |
| UI | Weekly Timetable section (Planner) | Timeline / Day grid |
| Calendar Week view | Overlay pattern | Instantiated or merged visually |

Weekly template is **planning scaffolding**; daily block is **execution instance**. Calendar Week mode may show both (template ghost + solid blocks).

---

## Calendar Data Model

Assume future Planner landing:

```
Month · Week · Day · Agenda
```

### What appears in each mode

| Object | Month | Week | Day | Agenda | Source |
| ------ | ----- | ---- | --- | ------ | ------ |
| **Event (note)** | Dot / chip on date | Bar or chip | Timed row if `eventTime` | Chronological row + countdown if future | Note projection |
| **Schedule block** | Density optional | Column blocks | **Hour grid** (primary) | Timed row | `/api/schedules?date=` |
| **Weekly template** | — | Ghost blocks | Hint only | — | `weekly_schedules` |
| **Routine** | — | Summary count | Checklist sidebar | Optional “habits” section | `routines_with_logs` |
| **Todo** | — | — | Checklist sidebar | Row | `/api/todos?date=` |
| **Milestone** | Subtle dot | — | — | Usually omit (not forward planning) | Note projection |
| **D-Day (legacy)** | Badge until migrated | Countdown | — | Countdown row | `/api/schedules/ddays` (transitional) |

### What should **not** appear in Planner Calendar

| Object | Owner |
| ------ | ----- |
| Archive mark density / heatmap | Archive |
| Domain workout marks | Health + Archive |
| Note activity marks | Archive |
| Productivity aggregates | Retired (K-30.3) |

### Recommended projection API (future code)

```typescript
// Architecture target — not implemented in K-30.21
interface PlannerCalendarProjection {
  date: string;
  events: PlannerEventRow[];      // from notes
  milestones: PlannerMilestoneRow[]; // optional month dots
  scheduleBlocks: Schedule[];     // from Supabase
  weeklyTemplate: WeeklySchedule[];
  todos: Todo[];
  routines: Routine[];
  legacyDdays: DDay[];            // transitional
  countdowns: CountdownRow[];     // derived from events + legacy
}
```

**Build order:** projection first, Calendar UI second (same pattern as Archive Home).

### Central primitive answer (Calendar consumer)

Calendar should treat **two visual families**:

1. **Anchors** — Events (future: sole anchor source; legacy D-Day during transition)
2. **Blocks** — Schedule instances + weekly template overlay

Execution lists (Routines, Todos) attach to **Day / Agenda**, not Month.

---

## Archive Interaction

### How Events appear in Archive

| Surface | Behavior today | Future |
| ------- | -------------- | ------ |
| Mark calendar | `event` mark type per day in range | Unchanged |
| Period browse | Via mark density + note activity | Event notes discoverable in period depth |
| Home | No dedicated event list (marks on calendar) | Optional “Upcoming → past events” in Period branch only — not Home |

Events are **historical context** once the date passes — same note, same mark, readable in trace lenses.

### How Milestones relate to Events

| Scenario | Model |
| -------- | ----- |
| Upcoming exam | **Event** on exam date |
| Received results | **Milestone** on results day (may be same note, new property) |
| Trip | **Event** with date range |
| “Started new job” | **Milestone** only |

Archive **Recent transitions** stays Milestone-first. Do not replace with Event list.

### D-Day in Archive

**Today:** D-Days are **absent** from Archive projections.

**After convergence:** Countdown dates captured as Events automatically gain Archive marks. Legacy unmigrated D-Days remain Planner-only until backfilled (migration script or user prompt).

### Historical planning data

| Data | Archive role |
| ---- | ------------ |
| Past Events | Mark calendar + note trace |
| Past Milestones | Recent transitions (time-sorted) |
| Past Schedule blocks | **Not indexed today** — optional future Period panel (“scheduled time”) if desired; not Home |
| Weekly templates | Operational — not Archive |
| Routine logs | Domain marks via heatmap API (already) |

**Principle:** Archive answers *what remains when you look back* — Events and Milestones are identity-bearing; schedule blocks are operational detail unless explicitly promoted later.

---

## Recommended Direction

### Central planning primitive (product answer)

> **There is no single primitive.** The central **planning model** is a **dual-layer composition**:
>
> - **Event** (note-backed) — the central **dated anchor**
> - **Schedule block** (Supabase) — the central **time allocation**
>
> Supported by **Weekly template**, **Routine**, and **Todo** for execution.

If forced to pick one **named** concept for “what Calendar is about”: **Events + Schedule blocks** — not D-Day, not Milestone, not Todo alone.

### D-Day fate

**Merge into Events (Option B).** Retire D-Day entity after migration. Preserve countdown presentation in Planner Agenda.

### Primitive ownership (target)

| Primitive | Write owner | Read surfaces |
| --------- | ----------- | ------------- |
| Event | Note | Note, Planner Calendar, Archive marks |
| Milestone | Note | Note, Archive Home / Period |
| Schedule block | Planner | Planner Day/Week, optional Agenda |
| Weekly template | Planner | Planner Week + Timetable section |
| Routine / Todo | Planner | Planner Day |
| D-Day | **Deprecated** | Legacy read → Event projection |

### Calendar data model (consumer answer)

Calendar consumes **`PlannerCalendarProjection`** merging:

- Note-derived **Events** (required)
- Supabase **Schedules** + **weekly_schedules** (required)
- **Routines** / **Todos** (Day/Agenda)
- Legacy **ddays** (temporary)
- **Milestones** (optional month hint only)

---

## Migration Path

Aligned with completed work (K-30.16–K-30.20). **No code in K-30.21.**

| Phase | Milestone | Deliverable |
| ----- | --------- | ----------- |
| **0** | **K-30.21 (this doc)** | Event / D-Day / Schedule architecture locked |
| **1** | K-30.22 | `buildPlannerEventProjection(notes, date, locale)` + tests |
| **2** | K-30.23 | Planner Calendar shell — Month + Day (Timeline rename) reading projection + schedules |
| **3** | K-30.24 | Week + Agenda modes; weekly template overlay |
| **4** | K-30.25 | Countdown / Agenda reads Events; legacy D-Day dual-read |
| **5** | K-30.26 | Planner “Add event” → Note event create; D-Day modal deprecated |
| **6** | K-30.27 | D-Day data migration + remove `/api/schedules/ddays` write path |
| **Parallel** | TBD | Optional Todo ↔ note-task bridge; Schedule→Event link metadata |

**Principles:**

1. **Projection before UI** — never mount Calendar components without typed projection.
2. **Dual-read before dual-write removal** — Events first, D-Day legacy fallback.
3. **Note remains capture authority for Events** — Planner shortcuts create notes, not shadow rows.
4. **No Archive leakage** — operational schedules stay out of Archive Home.

---

## Risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| Dual anchor systems persist too long | High | Explicit K-30.25–K-30.27 D-Day deprecation phases; document “create Event, not D-Day” |
| Event vs Schedule user confusion | Medium | Consistent labels: “Event” (happens) vs “Block” (allocated time); in-product examples |
| Milestone vs Event on same note | Low | Docs + dialog copy; Archive vs Planner roles clear |
| Planner Event create friction (Note-only today) | Medium | Planner shortcut to Event note; don’t require tab switch for common case |
| Migration data loss for D-Days | Medium | Export path exists (`csvExport`); migration tool maps `DDay → Event note` |
| Calendar scope creep | Medium | Reject dashboard; Milestones optional in Month; heatmap stays Archive |
| Weekly template vs block duplication | Low | Week view shows template as ghost; CRUD stays separate |
| Todo vs note-task divergence | Low | Defer bridge; don’t block Calendar on task unification |

---

## Relationship to Prior Milestones

| Milestone | Relationship |
| --------- | -------------- |
| K-30.17 | Direction audit — this doc deepens Event/D-Day/Schedule convergence |
| K-30.18 | Redistribution — operational widgets → Planner; anchors still undefined until this doc |
| K-30.19 | Legacy Analytics isolated — no impact on planning primitives |
| K-30.20 | Weekly Timetable in Planner — operational layer partial; anchor layer still split |
| K-28 / K-29 | Event / Milestone note models — authoritative for anchor layer |
| K-30.5 | Archive vs Planner domain rules — reaffirmed |

---

## Decision Record

| Question | Decision |
| -------- | -------- |
| Central planning primitive? | **Dual-layer:** Event (anchor) + Schedule block (allocation) |
| Calendar consumes what? | **`PlannerCalendarProjection`** — Events + Schedules + weekly template + Day lists (+ legacy D-Day transitional) |
| D-Day fate? | **Option B** — view over Events; entity deprecated |
| Remove D-Day UX? | **No** — preserve countdown in Agenda |
| Events replace Schedule blocks? | **No** |
| Events replace Milestones? | **No** |
| Events replace Routines/Todos? | **No** |
| Archive role for Events? | Mark calendar + trace; Milestones stay transitions |
| Implement now? | **No** — architecture only |

---

*K-30.21 — architecture only. Next execution: Event projection layer (K-30.22), then Calendar shell (K-30.23+).*
