# Knowledge-30.5 — Archive Identity

## Scope

Architectural definition only. **No implementation, no tab rename, no feature moves, no UI redesign.**

Builds on K-30.0 through K-30.4. **Revises K-30.4's elimination recommendation:** the Analytics tab should **survive**, but evolve into **Archive** — not Analytics, not Trace Summary as a duplicate of Note, not a productivity dashboard.

---

## Executive Summary

**K-30.4 asked:** Does Analytics deserve a unique tab?

**K-30.5 answer:** Yes — but only as **Archive**, a surface dedicated to **continuity over time**, not measurement or planning.

| Surface | Question | Mode |
| ------- | -------- | ---- |
| **Note** | What am I capturing and exploring now? | Active — write, link, lens |
| **Archive** | What remains when I look back? | Reflective — read, revisit, continuity |
| **Health / Planner** | What am I doing in this domain today? | Operational — log, schedule, execute |

Archive is the **long-horizon memory layer** K-28 described as *history* (years later). Note provides *traces* (months). Archive synthesizes traces across domains into **lived continuity**.

**Primary recommendation:** **Hybrid Archive (D)** — **Period** as default entry, **Area** as cross-cut, **Chronological timeline** as navigation scaffold. Evolve current `AnalyticsView` shell into Archive; redistribute planning widgets to Planner; keep Health operational detail in Health.

---

## What is an Archive?

### Working definition

> **Archive** answers: *What remains when I look back?*

Archive is a **read-only retrospective surface** — a place where marks accumulate visibly across time and domains, so a user can observe their own continuity without being scored, ranked, or optimized.

### What Archive is

| Property | Meaning |
| -------- | ------- |
| **Retrospective** | Oriented toward the past, not the plan |
| **Cross-domain** | Notes, body, life events, domains — one continuity story |
| **Evidence-based** | Shows marks, transitions, occurrences |
| **Long-horizon** | Useful at month, year, and five-year scales |
| **Non-judgmental** | No performance framing (K-28) |

### What Archive is not

| Anti-pattern | Why excluded |
| ------------ | ------------ |
| Productivity dashboard | Scores, targets, streaks |
| Planner | Forward scheduling, todos, timetables |
| Note editor | Capture and linking belong in Note |
| Analytics (legacy) | Measurement and optimization identity |
| Life interpretation engine | System-generated narratives about the user |

### K-28 lifecycle placement

```
Record  →  Trace  →  History
(today)    (months)   (years)
              ↑          ↑
            Note      Archive
         exploration  continuity
```

Note is where marks are **made** and **explored while working**. Archive is where marks are **revisited** as **history** — especially across domains and long periods.

### Archive principles

Every Archive item must satisfy **at least one**:

1. **It left a mark** — something recorded happened
2. **It marks a transition** — boundary, milestone, phase change
3. **It helps explain a period** — context for why activity looked a certain way
4. **It contributes to continuity** — links past to present path

Items must **not** exist merely because they were measured.

---

## What Belongs?

### Note domain

| Source | Archive-worthy? | Rationale |
| ------ | --------------- | --------- |
| **Milestones** | **Yes** | Transitions; define phases of a path |
| **Events** | **Yes** | Time-anchored occurrences; explain context |
| **Note activity** (created / edited) | **Yes** — summarized | Marks that something was alive in a period; not every edit listed |
| **Areas** (as lenses) | **Yes** — as cross-cut | Shows which concerns were active when |
| **Time lenses** (month / quarter / year / custom) | **Yes** — as Archive scope | Same calendar boundaries, different intent (look back vs work) |
| **Discover Patterns** | **Partial** | Observations about link structure — archive-worthy as *historical snapshot*, not live exploration |
| **Full note bodies** | **No** — link only | Archive points to notes; does not duplicate editor |
| **Folders / tags / search** | **No** | Organization for capture, not retrospective synthesis |
| **Workspace / DB views** | **No** | Operational productivity layer (K-19) |

**Rule:** Note owns **storage and exploration**. Archive **projects** milestone, event, and activity rollups from notes — plus links into the note graph.

---

### Health domain

| Source | Archive-worthy? | Rationale |
| ------ | --------------- | --------- |
| **Workout session history** | **Yes** | Body marks over time; continuity of physical activity |
| **InBody / body records** | **Yes** | Long-term body trace (weight, composition snapshots) |
| **Nutrition logs** (protein intake) | **Partial** | Factual intake records explain periods; daily goal tracking is operational |
| **PR badges / max comparisons** | **No** | Performance evaluation — stays out of Archive |
| **Protein goal calculator** | **No** | Optimization tool — Health only |
| **Exercise block library** | **No** | Reference/setup — not a mark |
| **Today's workout editor** | **No** | Operational — Health only |

**Rule:** Archive shows **that workouts and body records occurred** and **how they trend over years**. Health tab shows **how to log today** and **structured workout UX**.

---

### Planner domain

| Source | Archive-worthy? | Rationale |
| ------ | --------------- | --------- |
| **D-Day / countdown events** | **Yes** | Significant dates; often align with K-28 events over time |
| **Exception days** | **Yes** | Explain gaps — context for a period ("this week was noted as exception") |
| **Routine marks** (historical) | **Partial** | Factual "routines recorded on N days" — not completion grades |
| **Significant schedule blocks** (past) | **Partial** | Scheduled time as *context* for a period, not planning |
| **Timeline (future blocks)** | **No** | Forward planning |
| **Todos** | **No** — unless promoted to note/task trace | Operational; task notes in Note may appear via activity |
| **Weekly Timetable** | **No** | Recurring plan template — not history |
| **Memo** | **No** | Duplicate of Note |
| **Calendar date picker** | **No** | Navigation for planning |

**Rule:** Archive retains **what was noted about the past** (exceptions, passed D-Days, routine mark counts). Planner retains **what to do next**.

---

### Current Analytics sections → Archive mapping

Post-K-30.3 inventory mapped to Archive fate:

| Section | Archive? | Fate |
| ------- | -------- | ---- |
| Period Overview + range picker | **Yes** | Archive period scope (align labels with Note: Month, Quarter, Year) |
| Activity This Week | **Reframe** | Period summary panel — cross-domain mark counts |
| Scheduled Time by Category | **Partial** | Period *context* — hours as evidence, not ranking |
| Exception Days | **Yes** | Archive context |
| Activity Calendar (16 weeks → expand) | **Yes** | Core Archive widget — mark density over years |
| Workout Records week grid | **Move source** | Summary in Archive; detail link → Health |
| Today's Routine Marks | **No** | Planner (operational today) |
| Today's Schedule | **Partial** | Only when viewing a past day in Archive |
| Weekly Timetable | **No** | Planner only |

---

## What Does Not Belong?

Explicit exclusion list for Archive design reviews:

| Category | Examples | Belongs instead |
| -------- | -------- | --------------- |
| **Forward planning** | Weekly timetable, timeline blocks, todos | Planner |
| **Daily operations** | Log workout, check routine, edit schedule | Health / Planner |
| **Performance** | Streaks, PRs, completion %, goals | Nowhere (removed K-30.3) |
| **Capture / edit** | Note editor, quick capture, properties | Note |
| **Live exploration** | Graph view, search, discover patterns drill-down | Note |
| **Measurement identity** | "Analytics", charts implying KPIs | Retired naming |
| **Optimization** | Protein targets, efficiency metrics, Top Focus | Health / out of product |
| **Pure infrastructure** | Settings, folders, DB templates | Note workspace |

**Litmus test:** Would this item matter to you **five years from now** as part of your path? If only for **this week's execution**, it is not Archive.

---

## Archive Structure Candidates

### A — Chronological Archive

**Shape:** Single timeline of marks, newest or oldest first.

```
2026-06-12  TOEFL practice note edited
2026-06-11  Workout recorded
2026-06-10  Milestone: K-28 complete
2026-06-01  Event: Quarter started
```

| Pros | Cons |
| ---- | ---- |
| Intuitive "story of my path" | Overwhelming at scale |
| Strong continuity metaphor | Mixes domains without structure |
| Easy to implement as feed | Hard to answer "what was Q2 2026?" |

**Best for:** Supplementary view — scrollable mark feed within a period.

---

### B — Period Archive

**Shape:** Month / Quarter / Year (and custom) as primary containers.

```
2026 Q2
├── Milestones
├── Events
├── Activity overview
├── Areas active
├── Body marks
└── Noted exceptions
```

| Pros | Cons |
| ---- | ---- |
| Aligns with Note time lenses (same boundaries) | Risk of duplicating Note range UI |
| Natural "look back at that summer" | Less clear for cross-period themes |
| Matches K-28 range projections | Weekly scope gap (needs Week or custom) |

**Best for:** **Default Archive entry** — user picks a period, sees synthesis.

---

### C — Area Archive

**Shape:** Organized by concern (Japanese, TOEFL, Body, …).

```
Japanese
├── 2026 — N1 prep period
├── Milestones: JLPT N2 passed
├── Linked note activity over time
└── Events: Study abroad
```

| Pros | Cons |
| ---- | ---- |
| Matches K-29 Areas philosophy | Requires area membership model across domains |
| Answers "my path in X" | Body/workout areas need convention |
| Long-horizon identity | Weaker for "whole life in 2026" |

**Best for:** **Secondary lens** — cross-cut after period or from Area list.

---

### D — Hybrid Archive (recommended)

**Shape:** Period primary + Area cross-cut + Chronological drill-down.

```
Archive
├── Scope: [Month | Quarter | Year | Custom | Area…]
├── Period synthesis (default)
│   ├── Milestones · Events · Activity (from Note)
│   ├── Areas active in period
│   ├── Body marks summary
│   ├── Routine / exception context
│   └── Mark calendar (heatmap)
├── Area view (optional cross-cut)
│   └── Same sections filtered to area backlinks
└── Mark timeline (drill-down within scope)
    └── Chronological list linking to sources
```

| Pros | Cons |
| ---- | ---- |
| Period + Area + timeline each do what they do best | Most design and engineering effort |
| Distinct from Note without duplicating it | Requires clear IA to avoid confusion |
| Supports five-year revisit | Must define what's summary vs link |

**Tradeoffs vs A/B/C alone:**

| Need | Hybrid handles via |
| ---- | ------------------ |
| "What was that year?" | Period (B) |
| "My Japanese path" | Area (C) |
| "What happened around that exam?" | Timeline (A) within scoped period |

---

## Recommended Direction

### Primary: Hybrid Archive (D)

**Evolve Analytics tab → Archive** with:

1. **Default mode:** Period Archive (month / quarter / year / custom)
2. **Secondary mode:** Area Archive (reuse K-29 area notes + backlinks)
3. **Drill-down:** Chronological mark list within scope (read-only, links to Note / Health / Planner source)
4. **Signature widget:** **Mark calendar** — multi-year activity calendar (extend current Activity Calendar from 16 weeks → full history)
5. **Remove from Archive over time:** Weekly Timetable, today's operational widgets (K-30.6+)

### Identity statement (for future rename)

> **Archive** — *What remains when you look back.*

Sidebar icon candidate: Archive box, Layers, or Clock — **not** BarChart2.

In-view title replaces K-30.3 "Period Overview" when rename lands.

### Why Archive survives (revising K-30.4)

K-30.4 concluded Analytics should merge into Note because period review overlapped. K-30.5 reframes:

| K-30.4 assumption | K-30.5 correction |
| ----------------- | ----------------- |
| One period UI is enough | Note period lenses are **exploration**; Archive is **retrospection** |
| Cross-domain marks belong inside Note | Note is note-centric; Archive is **explicitly cross-domain** |
| Eliminate tab for simplicity | Tab is justified if identity is **Archive**, not Analytics |

**Distinct roles:**

| | Note time lens | Archive period |
| --- | -------------- | -------------- |
| **Intent** | Work, capture, follow links | Look back, observe continuity |
| **Horizon** | Today → this quarter (active) | Month → years (historical) |
| **Domains** | Notes only (today) | Notes + Health + Planner marks |
| **Interaction** | Open and edit notes | Read-only synthesis + deep links |
| **Discover Patterns** | Live exploration | Optional frozen observations |

A user may open **Note → This Month** while actively working, and **Archive → 2026 Q2** when reflecting — same calendar boundary, different purpose.

---

## Relationship to Note

### Division of responsibility

```
Note                          Archive
────                          ───────
Capture                       Revisit
Edit                          Read-only projections
Wiki links, graph             Synthesized rollups
Areas (designate, browse)     Areas (historical activity arcs)
Trace lenses (working)        Period / area history (reflecting)
Discover Patterns (explore)   Pattern snapshots (optional, dated)
```

### Data flow

- Archive **does not store** parallel entities.
- Archive **projects** from:
  - `buildRangeTraceProjection` / `buildAreaTraceProjection` (Note)
  - Health API history endpoints
  - Planner mark logs (routines, exceptions, past D-Days)
- Every Archive row **links** to source (note, workout log, planner record).

### Overlap management

| Risk | Mitigation |
| ---- | ---------- |
| Duplicate period pickers | Shared period vocabulary (Month, Quarter, Year); Archive adds Year-first navigation and multi-year calendar |
| User confusion | Clear copy: Note = "Explore traces" · Archive = "Look back" |
| Duplicate milestone lists | Archive shows summary; "Open in Note" for full lens |

### What Note keeps exclusively

- All writing and editing
- Graph, search, properties, relations
- Dashboard / workspace productivity (K-19)
- Discover Patterns interactive exploration
- Area designation (`type=area`)

---

## Relationship to Health

### Division of responsibility

```
Health                         Archive
──────                         ───────
Log today's workout            Show workout history in period
Manage blocks / routines       Summarize sessions in quarter/year
InBody entry                   Body record timeline
Protein tracking (daily)       Optional intake context for a period
PR comparison                  Excluded from Archive
```

### Archive Health panels (examples)

- "Workouts recorded: 12 sessions in 2026 Q1"
- InBody snapshots plotted or listed as dates (factual, not "progress toward goal")
- Link: "View sessions in Health →"

### Long-term body continuity

Five-year view: user sees **that they trained through 2024–2029**, not whether they "improved enough." Trends may appear as **evidence lines**, not grades.

---

## Relationship to Planner

### Division of responsibility

```
Planner                        Archive
───────                        ───────
Schedule tomorrow              Show past schedule context
Check routines today           Historical routine mark counts
Weekly timetable CRUD          Not in Archive
D-Day countdown (active)       D-Day as past event in Archive
Exception day setup            Exception days as period context
```

### What survives as trace from Planner

| Item | Archive representation |
| ---- | ---------------------- |
| D-Day passed | Event-like entry on date |
| Exception days | Listed under period context |
| Routine marks | "Routines recorded on N days" — counts only |
| Past schedule blocks | Optional read-only context when viewing that day |

### What never enters Archive

- Incomplete todos
- Future timeline blocks
- Weekly timetable templates
- Routine checkbox UI for today

---

## Five-Year View — Success Criteria

**When a user opens Archive in 2031 looking back at 2026, they should see:**

| They should see | Example |
| --------------- | ------- |
| **Milestones that bounded phases** | JLPT N2 passed; K-28 shipped; moved to Nagoya |
| **Events that explain context** | TOEFL exam date; military service start |
| **Which concerns were alive** | Japanese, Absinthe, Exercise areas active that year |
| **Note activity rhythm** | Periods of writing, dormancy, return — not productivity scores |
| **Body history as marks** | Workouts and InBody snapshots existed — session counts, dates |
| **Life context from Planner** | Exception weeks, significant D-Days — not missed routines |
| **Mark calendar** | Visual rhythm of days with any mark across the year |
| **Links to source material** | Open the note, workout log, or record — not a walled garden |

| They should not see | Why |
| ------------------- | --- |
| Streaks, grades, PR highlights | Performance |
| "You should have…" narratives | Judgment |
| Forward plans | Planner |
| Full duplicate of note library | Note owns content |
| Optimization suggestions | Anti-K-28 |

**Emotional target:** *"This is my path"* — not *"This is my report card."*

---

## Migration Path (future — not K-30.5 scope)

| Phase | Action |
| ----- | ------ |
| **K-30.6** | Rename tab Analytics → Archive; icon + i18n; retitle in-view |
| **K-30.7** | Wire Note trace projections into Archive period view |
| **K-30.8** | Move Weekly Timetable + today widgets out of Archive → Planner |
| **K-30.9** | Extend mark calendar; add Area Archive mode |
| **K-31.0** | Chronological drill-down; deep links to Note / Health / Planner |

---

## Open Questions (K-30.6+)

1. **Week scope** — Add "This Week" to Archive or always use Custom Range?
2. **Discover Patterns in Archive** — Live widget or omit entirely?
3. **Recipes / other silos** — Do recipe records appear as marks when Health merge completes?
4. **Shared period control** — One shared component between Note lenses and Archive, or parallel UX?
5. **Default Archive landing** — Current year? Current quarter? Last period with marks?
6. **Deletion ethics** — When user deletes a note, how does Archive reflect "removed historical evidence"?

---

## Relationship to Prior Milestones

| Milestone | K-30.5 relationship |
| --------- | ------------------- |
| K-30.4 | **Superseded** on tab elimination — Archive justifies dedicated surface |
| K-30.3 | Behavioral foundation retained — Archive inherits evidence-only framing |
| K-30.2 / K-30.0 | Analytics widgets classified → Archive vs Planner vs Health |
| K-28 | Archive = **History** stage of record → trace → history |
| K-29 | Area Archive = historical cross-cut of area lenses |
| K-26 | Note-first entry unchanged — Archive is secondary to Note, not primary |

---

*K-30.5 — defines Archive before building it. Analytics was the wrong name; elimination was the wrong conclusion. Continuity deserves a home.*
