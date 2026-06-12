# Knowledge-30.4 — Trace Summary Identity

## Scope

Architectural analysis only. **No implementation, no tab rename, no UI moves, no deletions.**

Builds on K-30.0 through K-30.3. K-30.3 reframed Analytics behavior; K-30.4 decides **what role the surface should play** in the long-term product.

---

## Executive Summary

**The core user question after K-30.3:**

> Why do Note and Analytics both exist?

**Answer today:** They partially duplicate *period review* intent on different data models. Note answers *what left marks in notes* (K-28/K-29). Analytics answers *what left marks in Planner/Health APIs* — but lives in a separate tab with its own period picker.

**Primary recommendation: Candidate D — Eliminate the Analytics tab** (long-term), adopting the **Trace Summary content model inside Note range lenses** (from Candidate A). The unique cross-domain aggregation Analytics currently provides should become a **read-only "Domain marks" layer** within Note's existing time lenses — not a parallel destination.

**Interim identity (until migration):** The Analytics tab is a **legacy cross-domain period view** transitioning toward obsolescence. In-view title "Period Overview" (K-30.3) is accurate but insufficient as a permanent product identity.

---

## The Structural Problem

### Note today (K-28 / K-29)

| Capability | Question answered |
| ---------- | ----------------- |
| Today | What left marks on this day? |
| This Month / Quarter / Year / Custom Range | What left marks in this period? |
| Areas (+ area × time) | What left marks in this concern? |
| Discover Patterns | What link clusters appear? |

**Data source:** `Note` store — milestones, events, note activity (created/edited), wiki links.

### Analytics today (post-K-30.3)

| Capability | Question answered |
| ---------- | ----------------- |
| Period Overview + range picker | What happened in this period? *(same question, different data)* |
| Activity This Week | Workout / routine / study marks (API) |
| Scheduled Time by Category | Where scheduled hours went (Planner) |
| Activity Calendar | Which days had any domain marks (16 weeks) |
| Exception Days | When routines were paused (Planner) |
| Workout Records | Which days had workouts (Health) |
| Today's Routine Marks | Today's routine checkmarks (Planner) |
| Today's Schedule | Today's timeline blocks (Planner) |
| Weekly Timetable | Recurring weekly plan (Planner) |

**Data source:** `/api/schedules`, `/api/heatmap`, `/api/workouts`, `/api/routines`, `/api/weekly_schedules`, `/api/routine_exceptions` — **no Note integration**.

### Overlap map

| User intent | Note | Analytics | Overlap |
| ----------- | ---- | --------- | ------- |
| Review a calendar period | ✓ Range lenses | ✓ Period Overview | **High** — same mental task |
| See milestones / events | ✓ | ✗ | None |
| See note activity | ✓ | ✗ | None |
| See workout / routine marks | ✗ | ✓ | None today — **unique to Analytics** |
| See schedule context | ✗ | ✓ | **Unique to Analytics** |
| Plan recurring weekly blocks | ✗ | ✓ (misplaced) | Should be Planner |
| Explore by area | ✓ | ✗ | None |

**Conclusion:** Overlap is in **navigation and period scoping**, not in data. Analytics' remaining unique value is **cross-domain API marks + schedule context** — but that value does not require a **separate top-level tab** once Note lenses can embed domain summaries.

---

## Current Analytics Inventory

All sections remaining in `AnalyticsView.tsx` after K-30.3.

| # | Section | Data source | Domain |
| - | ------- | ----------- | ------ |
| 1 | **Period Overview** (header) | — | Shell |
| 2 | **Time range selector** (Today / Weekly / Monthly / Custom) | Local state | Shell |
| 3 | **Activity This Week** | `/api/heatmap` + schedules | Cross-domain |
| 4 | **Scheduled Time by Category** | `/api/schedules/range` | Planner |
| 5 | **Exception Days** | `/api/routine_exceptions` | Planner |
| 6 | **Activity Calendar** (16 weeks) | `/api/heatmap` | Cross-domain |
| 7 | **Workout Records** (week grid) | `/api/workouts/range` | Health |
| 8 | **Today's Routine Marks** | `routines` prop (Planner API) | Planner |
| 9 | **Today's Schedule** (daily only) | `/api/schedules/range` | Planner |
| 10 | **Weekly Timetable** + CRUD modal | `/api/weekly_schedules` | Planner |

---

## Section Classification

For each section: where it belongs long-term.

| Section | 1. Note | 2. Planner | 3. Health | 4. Trace Summary* | 5. No future role |
| ------- | ------- | ---------- | --------- | ----------------- | ----------------- |
| Period Overview header | | | | Interim shell | |
| Time range selector | **Primary** — already in Note sidebar | | | Duplicate until merged | |
| Activity This Week | Embed as **Domain marks** panel in range lens | Partial (routine counts) | Partial (workout counts) | Interim aggregate view | |
| Scheduled Time by Category | Optional link/summary in range lens | **Primary** | | Interim | |
| Exception Days | Reference in range lens context | **Primary** | | Interim | |
| Activity Calendar | **Primary** — unified mark calendar in Note | Feed data | Feed data | Interim until Note owns calendar | |
| Workout Records | | | **Primary** | Interim | |
| Today's Routine Marks | | **Primary** | | Interim | |
| Today's Schedule | Overlaps Note daily trace | **Primary** | | Interim | |
| Weekly Timetable | | **Primary** (only) | | | **Misplaced** — not review |

\*Trace Summary = cross-domain read-only aggregation concept; **not necessarily a permanent tab** (see Candidate D).

### Classification key

- **Note:** K-28 trace lenses are the canonical period-review entry. Domain marks become a subsection: *"Also recorded outside notes this period."*
- **Planner / Health:** Operational domains keep detailed views; Analytics only duplicates summaries.
- **Trace Summary (interim tab):** Holds cross-domain panels until Note embeds them.
- **No future role:** Weekly Timetable CRUD in a review surface — planning, not traces.

---

## Candidate Evaluation

### Candidate A — Trace Summary

**Identity:** Analytics tab renamed to **Trace Summary** — high-level summary of marks across all domains.

**Questions answered:** What left marks? What happened this period? What domains appeared?

**Pros**

| Pro | Detail |
| --- | ------ |
| K-28 alignment | Name matches philosophy ("summary of marks") |
| Preserves dedicated review surface | Users who want one glance don't hunt inside Note |
| Cross-domain story | Can unify note traces + API marks in one period view |
| Clear rename path | K-30.3 already removed evaluative behavior |

**Cons**

| Con | Detail |
| --- | ------ |
| Note overlap | Range lenses already answer "what left marks" for notes |
| Dual period pickers | Today/Weekly/Monthly in Analytics vs Today/Month/Quarter in Note |
| Implementation cost | Must add Note projections to Analytics (or vice versa) to fulfill the name |
| Tab proliferation | Five tabs remain; identity problem partially persists |

**Conflicts**

- K-26 note-first entry: second "trace" home competes with Note
- K-29 Areas: area-scoped review lives in Note only
- Weekly Timetable: planning CRUD contradicts "summary" identity

**Dependencies**

- Note trace projections wired into the tab (K-30.5+)
- Domain bridge API or client-side aggregation layer
- Tab rename + icon change (BarChart2 → neutral)

**Verdict:** Strong **content model**, weak **permanent tab** unless overlap with Note is explicitly resolved.

---

### Candidate B — Period Overview

**Identity:** Analytics becomes **Period Overview** — cross-domain, workspace-level; Note stays note-centric.

**Questions answered:** What occurred across the workspace this period?

**Pros**

| Pro | Detail |
| --- | ------ |
| Matches K-30.3 in-view title | Already shipped |
| Neutral naming | Less "measurement" than Analytics |
| Clear split | Note = notes; Overview = everything else |

**Cons**

| Con | Detail |
| --- | ------ |
| User mental model | "Overview" vs "This Month" — unclear difference |
| Still two period UIs | Same navigation confusion |
| Vague philosophy fit | Doesn't convey K-28 "marks" vocabulary |
| Workspace undefined | Absinthe has no unified "workspace" entity at app level |

**Conflicts**

- K-28 uses "trace" not "overview"
- Note already provides period lenses — "overview" sounds like a superset that should include notes but doesn't

**Dependencies**

- Explicit UX copy explaining Note vs Overview
- Note trace sections in Overview to avoid hollowness

**Verdict:** Acceptable **interim label**, weak **long-term identity**. Does not answer why the tab exists.

---

### Candidate C — Review

**Identity:** Analytics becomes **Review** — user-authored and system-supported reflection.

**Questions answered:** What do I make of this period? (reflection, not raw evidence)

**Pros**

| Pro | Detail |
| --- | ------ |
| Human-centered | Emphasizes meaning-making (K-28: "meaning belongs to you") |
| Template path | Monthly/quarterly review notes (K-19 journal convention) |
| Distinct from Note browse | Reflection ritual vs capture/explore |

**Cons**

| Con | Detail |
| --- | ------ |
| Current content mismatch | Widgets are API aggregates, not reflection prompts |
| Overlap with trace summaries | Range lenses already support review-by-reading |
| Implies authorship | Review notes belong in Note editor, not dashboard |
| Risk of productivity framing | "Review" can mean performance retrospective |

**Conflicts**

- K-28 anti-goal: life interpretation engine
- Empty without review-note templates and user workflow design

**Dependencies**

- Review note templates (`type=review`, period property)
- Deliberate empty states and capture prompts
- Removal of domain aggregate widgets or reposition as "evidence for your review"

**Verdict:** Better as a **Note workflow** (review note templates linked from range lenses) than as **Analytics tab identity**. Not recommended as tab rename target.

---

### Candidate D — Eliminate Analytics Tab

**Identity:** No dedicated Analytics/Trace Summary tab. Functionality redistributed.

**Pros**

| Pro | Detail |
| --- | ------ |
| Simplest product surface | Note-first identity complete (K-30.1 intent) |
| Eliminates "why both?" | Single period-review entry in Note |
| Domain ownership | Planner/Health own their marks |
| K-30.0 alignment | Recommended eventual path |

**Cons**

| Con | Detail |
| --- | ------ |
| Migration effort | Cross-domain calendar, bridges, nav changes |
| Loss of one-glance cross-domain view | Unless Note embeds domain panels |
| Short-term gap | Note lenses don't show workouts/routines yet |
| User habit | Existing users may expect Analytics tab |

**Conflicts**

- Requires K-30.5+ implementation before tab removal
- Activity Calendar needs a home in Note or domains

**Dependencies**

- Domain mark panels in `RangeTraceLensView` / `DailyTraceDayView`
- Move Weekly Timetable, routine marks, workout week to Planner/Health
- Sidebar tab removal + optional deep-link redirects

**What would be lost without replacement**

| Loss | Mitigation |
| ---- | ---------- |
| Single-screen cross-domain period glance | "Domain marks" section in Note range lens |
| 16-week Activity Calendar | Note mark calendar fed by unified mark index |
| Weekly Timetable quick access | Planner tab |

**Verdict:** **Recommended primary direction.** Analytics' unique value is **aggregated evidence**, not **aggregated navigation**. Evidence belongs under Note time lenses; domain detail belongs in Planner/Health.

---

## Recommended Direction

### Primary: Candidate D — Eliminate Analytics tab

Adopt **Trace Summary as a content model inside Note**, not as a competing tab (Candidate A as **architecture**, not **surface**).

```
Long-term shape:

Note (default)
├── Capture — All Notes, editor
├── Explore by Time — Today → Custom Range
│   ├── Milestones / Events / Activity     ← K-28 (existing)
│   └── Domain marks (collapsed)           ← migrated from Analytics
│       ├── Workout records
│       ├── Routine marks
│       └── Schedule context (read-only)
├── Explore by Area — Areas, Discover Patterns
└── Workspace — dashboards, DB views (secondary)

Planner — routines, todos, timeline, weekly timetable, D-Day
Health  — workouts, body, nutrition
```

**Why not keep Trace Summary as its own tab (Candidate A alone)?**

1. **No unique navigation role** — period scoping duplicates Note.
2. **K-30.1 established Note as product core** — a second trace home undermines that.
3. **K-30.3 fixed behavior, not structure** — the structural fix is consolidation.
4. **Trace Summary name** applies to what users see **inside** range lenses, not sidebar cardinality.

**Why not Period Overview or Review (B / C)?**

- **B** describes current UI without resolving duplication.
- **C** fits Note templates, not API dashboard widgets.

### Interim state (now → migration complete)

| Element | Status |
| ------- | ------ |
| Sidebar label | **Analytics** (unchanged until K-30.6) |
| In-view title | **Period Overview** (K-30.3) |
| Role | **Legacy cross-domain view** — documented, transitional |
| New features | Do not add to Analytics; add to Note lenses or domains |

---

## Migration Implications

If Candidate D is adopted in K-30.5+:

### Moves

| From Analytics | To | Notes |
| -------------- | -- | ----- |
| Weekly Timetable + CRUD | **Planner** | Planning only |
| Today's Routine Marks | **Planner** | Today column / routines panel |
| Today's Schedule | **Planner** (timeline) | Or read-only link from Note Today lens |
| Workout Records week grid | **Health** | Read-only indicator |
| Exception Days | **Planner** | Settings or routines context |
| Scheduled Time by Category | **Planner** | Period summary in Planner or Note domain panel |
| Activity This Week aggregates | **Note** range lens Domain marks | Client aggregation |
| Activity Calendar | **Note** range lens or global mark calendar | Unified mark index |

### Stays (in Note trace lenses)

| Content | Section |
| ------- | ------- |
| Milestones, Events, Activity | Existing K-28 |
| Area-linked activity | Existing K-29 |
| Domain marks summary | **New** subsection |
| Discover Patterns | Unchanged |

### Disappears

| Item | Reason |
| ---- | ------ |
| Analytics tab | Redundant with Note + domains |
| Duplicate period picker in Analytics | Note lenses own time scope |
| `AnalyticsView.tsx` as top-level view | Decomposed or deleted after migration |
| i18n `yourAnalytics`, BarChart2 icon | Tab removed |

### Phased migration (suggested)

| Phase | Work |
| ----- | ---- |
| **K-30.5** | Add read-only **Domain marks** panel to `RangeTraceLensView` + `DailyTraceDayView` (workout/routine counts from existing APIs) |
| **K-30.6** | Move Weekly Timetable to Planner; demote Analytics tab order or hide behind Note link |
| **K-30.7** | Activity Calendar in Note; remove from Analytics |
| **K-30.8** | Remove Analytics tab; redirect `activeTab === 'analytics'` → Note with range lens pre-selected |

---

## Open Questions (for K-30.5 planning)

1. **Unified mark index** — Client-side merge of heatmap + note activity, or new backend projection?
2. **Weekly vs monthly scoping** — Note lacks "This Week" lens; add week scope or map Activity This Week to Custom Range?
3. **Area × domain marks** — Should workout marks appear in Area lens when linked via notes?
4. **Empty Analytics during transition** — Show banner "Domain marks moving to Note → This Month"?
5. **Mobile** — Does eliminating a tab reduce bottom-nav crowding enough to matter?

---

## Success Criteria (K-30.4)

- [x] Every remaining Analytics section inventoried
- [x] Candidates A / B / C / D evaluated with pros, cons, conflicts, dependencies
- [x] Primary recommendation stated with rationale
- [x] Migration implications documented
- [x] Unique role question answered

**Answer:**

> Analytics no longer has a compelling unique role as a **top-level tab**. Its remaining value is **cross-domain mark aggregation**, which should live inside **Note time lenses** (Trace Summary content model). Operational and domain-specific surfaces move to **Planner** and **Health**. The Analytics tab should be **eliminated** once Note embeds domain marks — not renamed in isolation.

---

## Relationship to Prior Milestones

| Milestone | Relationship |
| --------- | ------------ |
| K-30.0 | Recommended Analytics removal/merge — K-30.4 confirms with post-K-30.3 inventory |
| K-30.1 | Note-first nav — elimination completes that intent |
| K-30.2 | Classified sections — classification refined with migration targets |
| K-30.3 | Behavioral transition — structural decision deferred to this doc |
| K-28 / K-29 | Note lenses remain canonical trace home |

---

*K-30.4 — architectural analysis only. Trace Summary is what users see; Note is where they should see it.*
