# Knowledge-28.0 — Daily Trace, Events, and Milestones (Design Foundation)

## Scope

Design-only milestone. **No user-facing functionality, no behavior changes, no UI changes, no runtime refactors.**

K-24–K-27 ontology exploration (Thread, Continuity, Movement, Attractor) is closed. K-28 focuses on **product behavior, data model, and user experience** for a time-indexed trace layer over notes.

Evidence base: K-19 note conventions (daily notes, task/journal templates), database calendar/timeline views, property system, and current `Note` model.

---

## Executive Summary

Absinthe is a **trace-first memory environment**, not a productivity system. K-28 adds a **time-indexed layer over notes** — it does not introduce a planner, habit tracker, streak system, or life-interpretation engine.

**Daily Trace** is a **computed projection** for a calendar day: what left marks (note activity, events, milestones, optional session summary). It is **not** an entity with CRUD, lifecycle, or database table.

**Events** and **milestones** are light marks on notes (properties + optional tags), not parallel entity types. **Scope summaries** (day, week, month, quarter, year, custom range) are read-only rollups over projections.

---

## Trace Philosophy & Anti-Goals

### Core statement

> Daily Trace is not a record of performance.
>
> It is a record of what left marks.

A trace records that something happened. It does not evaluate whether it was enough, whether a day was successful, or assign worth.

### Records → traces → history

| Stage | Meaning |
| ----- | ------- |
| **Record** | A note created today is simply a record |
| **Trace** | Months later, that note becomes part of a trace |
| **History** | Years later, it becomes part of a history |

The purpose of preserving traces is **historical continuity**, not operational usefulness. Old TOEFL notes, early vocabulary lists, abandoned drafts, and obsolete project documents may no longer support current work — they still represent part of the user's path.

### Note lifecycle

Inactive does not mean disposable.

```
Active → Dormant → Preserved
```

Not:

```
Active → Obsolete → Delete
```

Deletion remains available. Deletion should be understood as **removal of historical evidence**, not merely storage cleanup. (Runtime lifecycle states are a future milestone; this doc establishes the product intent.)

### Attention shifts

Attention moves. History remains.

Users move between Japanese, TOEFL, EJU, Exercise, Absinthe, and future concerns. The movement of attention should be visible. Past traces should remain accessible. The system must not require users to continuously maintain old structures.

### Time philosophy

Time is **evidence**, not a score.

| Purpose of recording time | Not the purpose |
| ------------------------- | --------------- |
| Understanding attention | Optimization pressure |
| Understanding change | Guilt generation |
| Understanding context | Performance comparison |

**Useful questions:** What received attention? What changed this month? What milestones occurred? What events influenced activity?

**Not useful:** Did I reach my target hours? Was today productive enough? How many days is my streak?

### Representation principle

- Show evidence. Avoid judgment.
- Show marks. Avoid scores.
- Show history. Avoid performance narratives.

When uncertain: prefer **observation over evaluation**, **traces over metrics**, **preservation over optimization**.

### Guiding question

When evaluating any K-28 feature, ask:

> Does this help the user see what left marks?

Do **not** ask:

> Does this make the user appear more productive?

If a feature encourages performance theater, it is outside K-28 intent.

### Anti-goals (explicit)

K-28 must **not** become:

| Anti-goal | Prohibition |
| --------- | ----------- |
| **Productivity dashboard** | No productivity score, daily score, weekly score, or performance ranking |
| **Streak system** | No streak counters, continuity badges, or "don't break the chain" mechanics. Continuity emerges from traces; it is not gamified |
| **Habit tracker** | Goal is understanding activity, not enforcing repetition |
| **Planner** | Daily Trace records marks that occurred; planning is a separate concern |
| **Life interpretation engine** | No auto-generated narratives ("You seem less motivated", "You are abandoning Japanese", "Your productivity is declining"). The system presents traces; meaning belongs to the user |

### Failure mode to avoid

```
Record → Optimize → Performance theater
```

Absinthe must preserve:

```
Study → Record
```

Not:

```
Record → Maintain records → Optimize records
```

---

## 1. Daily Trace

### Definition

A **Daily Trace** is the calendar-day **projection** of what left marks in Absinthe on that day:

- Note activity (created, meaningfully edited)
- Events (time-anchored occurrences)
- Milestones (boundary markers)
- Optional session summary (internal rollup, subtle UI)

**Question answered:** "What happened on this day?"

**Not answered:** "How productive was this day?"

### What it is not

- Not a mandatory daily note
- Not a dashboard-first entry point
- Not a duplicate of note content
- Not an entity with CRUD or lifecycle
- Not a database table

### Product shape

```typescript
// Computed — not persisted as primary source of truth
interface DailyTraceProjection {
  date: string; // YYYY-MM-DD, local calendar day
  activities: TraceActivity[];
  events: TraceEventRef[];
  milestones: TraceMilestoneRef[];
  sessionSummary?: { engagedMs: number; notesTouched: number };
}
```

**Optional anchor:** ordinary note titled `YYYY-MM-DD` (K-19 daily-note convention) if the user wants a writable day page. Idempotent create only; never required.

**Empty day:** No nag surface. Neutral date navigation with "Nothing recorded yet" and Capture only — or hide day UI entirely until marks exist.

---

## 2. Events

### Definition

A **meaningful occurrence** anchored in time: something that happened (or will happen) on a day or clock time.

Examples: TOEFL exam, JLPT exam, Nagoya interview, trip, military service period start, publication.

Events provide **context**. They explain shifts in activity.

Distinct from note activity (process) and milestones (boundary markers).

### Implementation: Event-as-note

```typescript
// Note properties (convention)
properties: {
  type: 'event',
  eventDate: '2026-06-11',       // required
  eventTime?: '14:30',           // optional
  eventEndDate?: '2026-06-12',   // optional range
  eventEndTime?: '16:00',
}
```

- Body optional — title-only stub notes allowed
- Linkable via wiki links and relations
- Queryable via database views (`property:type=event`)

No separate Events app tab at K-28. Reuse timeline/calendar database presentations.

---

## 3. Milestones

### Definition

A **boundary marker** in time: start, completion, checkpoint, deadline crossed, phase change — not the ongoing work itself.

Examples: Started N1 prep, Finished draft, K-26 complete, Pull-up 20 reps.

Milestones are **state changes**, not ongoing work.

### Event vs milestone

| | Event | Milestone |
| --- | ----- | --------- |
| Meaning | Occurrence | Transition / marker |
| Question | What happened? | What changed state? |
| Visual | Timed row | Marker on day rail |

### Implementation: Milestone-as-property

Preferred on an existing note:

```typescript
properties: {
  milestoneDate: '2026-06-11',
  milestoneKind: 'start' | 'complete' | 'checkpoint' | 'deadline',
  milestoneLabel?: 'Draft v1 shipped',  // optional display override
}
```

Optional tag: `milestone` for queries.

**Derived milestone:** Task template `completedAt` projects as milestone on completion day — mechanical, user-confirmed completion only. Never auto-generate milestone labels the user did not confirm (except this derived case).

Avoid a separate Milestone entity if possible.

---

## 4. Time recording

### Primary unit: calendar day (local timezone)

- Day boundary: user's local midnight
- `traceDate: YYYY-MM-DD` is the canonical day key for rollups
- User-assigned `traceDate` property **wins** over system timestamp when backdating

### Secondary: time-of-day (optional, event-heavy)

| Level | Format | Use |
| ----- | ------ | --- |
| Day-only | `2026-06-11` | Journals, milestones, vague events |
| Time | `2026-06-11T14:30` (local) | Appointments, sessions |
| Range | start + end (same or cross-day) | Meetings, study blocks |

Cross-day event ranges appear on **each day** they touch, with a "continues" hint.

### Note activity timing

- **Created** → `createdAt` day (or `traceDate` override)
- **Edited** → day of edit session
- **Opened read-only** → optional, policy-off by default (noise)

`createdAt` / `updatedAt` remain authoritative for sync/history. Trace layer maps timestamps → trace day; does not replace note model.

### Session summary (optional, subtle)

If episode instrumentation exists (K-27B):

- Total engaged time that day
- Notes touched count

Display as **small metadata**, not headline metric. Hide when zero. Never frame as target or deficit.

---

## 5. Property conventions (K-28)

No new tables required. Extensions to existing `Note.properties`:

| Key | Values | Role |
| --- | ------ | ---- |
| `type` | `event` | Event discriminator |
| `eventDate`, `eventTime`, `eventEndDate`, `eventEndTime` | ISO date/time fragments | Event timing |
| `milestoneDate` | `YYYY-MM-DD` | Milestone day |
| `milestoneKind` | `start\|complete\|checkpoint\|deadline` | Milestone type |
| `milestoneLabel` | string | Display override |
| `traceDate` | `YYYY-MM-DD` | User-assigned trace day |

---

## 6. Connection model

```
        Time (calendar)
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
 traceDate  eventDate  milestoneDate
    │         │         │
    └────┬────┴────┬────┘
         ▼         ▼
      DailyTrace(D)  ← projection
         │
    references (ids only)
         │
         ▼
       Note(s)  ← sole content store
```

| Signal | Type | In Daily Trace |
| ------ | ---- | -------------- |
| Note edited | Derived | Activity |
| User adds event | Explicit | Event |
| User marks milestone | Explicit | Milestone |
| Task `completedAt` set | Derived | Milestone |
| Episode log | Internal | Session summary only |

---

## 7. Scope summaries

Accepted scopes: **Day**, **Week**, **Month**, **Quarter**, **Year**, **Custom Range**.

Custom Range is **first-class** — user thinks in military service period, N1 preparation, Nagoya application season, not only calendar quarters.

Summaries are **read-only rollups** over Daily Trace projections — not new content unless the user invokes a journal template.

**Do not auto-write** monthly essays. Offer **"Create review note"** (existing journal templates) prefilled with **links and lists**, not generated prose or AI narratives.

```typescript
interface TraceScopeSummary {
  scope: 'week' | 'month' | 'quarter' | 'year' | 'custom';
  startDate: string;
  endDate: string;
  daysWithActivity: number;
  milestones: TraceMilestoneRef[];
  events: TraceEventRef[];
  topNotes: { noteId: string; title: string; touchCount: number }[];
}
```

Custom range: date picker + optional save as **named saved view query** (`traceDate:2026-01-01..2026-03-31`), not a new Period entity.

### Summary UX principles

| Do | Don't |
| ---- | ----- |
| Link into notes and days | Inline full bodies |
| Show markers and counts | Productivity scores |
| Offer review note template | Auto guilt copy |
| Hide empty scopes | Empty dashboard sections |
| Subtle activity dots | Streak counters |

---

## 8. Focus Areas (under-specified — future K-28+)

User naturally thinks in domains: Japanese, TOEFL, EJU, Exercise, Absinthe.

**Direction:** Area Notes — not Project objects, Goal objects, or Life-plan objects.

Potential shape:

- Ordinary note tagged `area` or `area:japanese`
- Events and milestones connect via wiki links, relations, or optional `area` property
- Area-scoped summaries via saved views / rule collections

Structure is **earned** when notes cluster around a concern — not when the user creates a "Japanese Project."

Follow-up questions (deferred):

1. How should Focus Areas be represented?
2. How do Areas connect to Events?
3. How do Areas connect to Milestones?
4. What should Scope Summary UX look like per area?
5. How should custom periods be surfaced?
6. How review traces without productivity scoring? (Answered by anti-goals above; UX detail TBD)

---

## 9. UX flows (target)

### Entry (K-26 safe)

Default remains Note list / last note / Capture. Daily Trace is **reachable**, not blocking:

- Date control: **Today ▾** → Day view (trace projection)
- Capture and Open note remain primary actions
- No "Start your daily trace" nag

### Day view (read-only index)

Sections (when non-empty): Milestones → Events (timed) → Activity → optional daily anchor note link.

Tap row → open note. **Event** / **Milestone** actions → minimal modal → creates/updates note properties.

### Scope navigation

Month grid with **dots** on days with trace (no dot = no noise). Summary tab: milestones + events + top notes. **Create review note** from template.

---

## 10. Relationship to existing features

| Existing | K-28 relationship |
| -------- | ----------------- |
| Note + properties | Sole content store; K-28 adds trace property conventions |
| Journal templates | User-triggered review notes; appear in Daily Trace as activity |
| Task templates | `completedAt` → derived milestone |
| Database calendar/timeline | Query `type=event` or date properties |
| Quick capture | Activity on create day |
| Workspace dashboard | De-emphasized; day view is not a dashboard widget at K-28 |
| Planner (`PlannerView`, API todos) | **Out of scope** — separate domain until explicitly bridged |
| K-19 "productivity workflow" language | Orchestration layer remains; K-28 reframes time UI as trace, not performance |

---

## 11. Suggested phasing

| Phase | Scope |
| ----- | ----- |
| **K-28.0** | This document — design foundation + anti-goals |
| **K-28.1** | Property conventions + `buildDailyTraceProjection()` + read-only Day view |
| **K-28.2** | Event create/edit (note-as-event) + milestone mark on note |
| **K-28.3** | Episode attribution (if K-27B landed) + subtle session summary line |
| **K-28.4** | Month view + optional daily anchor note idempotent create |
| **K-28.5** | Quarter / year / custom scope + review template bridge |
| **K-28.6+** | Focus Area conventions + area-scoped summaries; note lifecycle (dormant/preserved) |

---

## 12. Out of scope (K-28)

- Productivity scores, streaks, habit tracking, target hours
- AI-generated life narratives or motivation copy
- Planner ↔ Notes merge
- `DailyTrace` entity, CRUD, or database table
- Thread / Attractor / Continuity ontology UI
- Automatic life interpretation
- Returning to K-24 ontology debates unless a design problem explicitly requires it

---

## 13. Success criteria (K-28.0)

- [x] Daily Trace defined as computed projection, not entity
- [x] Event-as-note and milestone-as-property conventions documented
- [x] Trace philosophy and anti-goals explicit and testable
- [x] Time-as-evidence principle documented
- [x] Note preservation intent (Active → Dormant → Preserved) documented
- [x] Scope summary model including custom range documented
- [x] Focus Areas flagged as future work with direction
- [x] No runtime behavior changes
- [x] Phasing roadmap for K-28.1+

---

## Appendix — Key file references

| Area | Path |
| ---- | ---- |
| Note model | `components/views/noteUtils.ts` |
| Properties | `features/knowledge/properties/noteProperties.ts` |
| Calendar bucketing | `databaseViews/bucketNotesByDate.ts` |
| Timeline view | `databaseViews/prepareDatabaseTimelineItems.ts` |
| Task conventions | `workspace/taskTemplateModels.ts` |
| Journal templates | `workspace/journalTemplateRegistry.ts` |
| Daily note convention | `docs/Knowledge-19.0-workspace-productivity-review.md` |
