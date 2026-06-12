# Knowledge-30.7 — Archive Home Architecture

## Scope

Archive **Home** design only. **No implementation, no tab rename, no components, no surrounding nav changes.**

Builds on [K-30.6 Archive Information Architecture](./Knowledge-30.6-archive-information-architecture.md). K-30.6 defined Archive IA (Home · Period · Area · Timeline); K-30.7 specifies **what Home is** and **what appears in the first five seconds**.

---

## Executive Summary

**Archive Home** is the **orientation layer** — the moment the product says *"you are looking back."*

**The very first thing users should see:** The word **Archive** and a single continuity frame (*"What remains when you look back."*), followed immediately by the **mark calendar** — a multi-year field of marks that proves history exists without counting or scoring it.

**Recommended layout:** **Candidate D — Balanced Hub** with strict visual hierarchy: **Frame → Calendar → Transitions → Paths**. Period browser and current position are **compact wayfinding**, not hero content. Timeline preview is **omitted from Home** (noise); Timeline remains a drill-down from Period or Area.

---

## Archive Home Goals

### Primary goals

| Goal | Success signal |
| ---- | -------------- |
| **Establish mode** | User feels "I am looking back" within 5 seconds |
| **Show continuity** | History is visible as a field of marks across years — not a blank dashboard |
| **Surface meaning** | Transitions (milestones) appear before raw activity volume |
| **Offer paths** | Clear exits to Period, Area, and calendar-scoped depth |
| **Stay read-only** | No capture, no checkboxes, no planning affordances |

### Secondary goals

| Goal | Success signal |
| ---- | -------------- |
| **Orient in time** | User knows "where now" sits inside the archive (2026 · Q2) |
| **Support sparse data** | Empty Home still communicates identity, not failure |
| **Support rich data** | Home remains scannable — not an infinite feed |
| **Differentiate from Note** | No note list, no editor chrome, no productivity widgets |

### Non-goals (explicit)

Archive Home must **not**:

| Anti-goal | Examples to exclude |
| --------- | ------------------- |
| Analytics dashboard | KPI cards, weekly stats grids |
| Productivity report | Routine %, study hours leaderboard |
| Planning surface | Timetable, todos, today's checklist |
| Health tracker | PR highlights, goal progress |
| Performance framing | Streaks, rankings, completion rates, "Less → More" optimization |

---

## What Belongs on Archive Home?

### Belongs

| Element | Role on Home |
| ------- | ------------ |
| **Title + continuity frame** | Identity in one line |
| **Mark calendar** | Signature visual — multi-year mark field |
| **Recent milestones** | Meaning-first transitions (limited list) |
| **Area entry points** | Concern-based navigation (pills or compact list) |
| **Compact period wayfinding** | Browse This Year / Quarter / Month / Custom |
| **Current position (compact)** | Optional one-line "You are here" — not a hero |

### Does not belong

| Element | Why excluded | Where instead |
| ------- | ------------ | ------------- |
| **Timeline preview feed** | Noise; duplicates Period drill-down | Timeline view within scope |
| **Full period browser tree** | Too heavy for Home | Period branch |
| **Activity counts as hero** | Volume over meaning | Period summary (summarized) |
| **Health week grid** | Operational | Health tab; summary in Period |
| **Weekly Timetable** | Planning | Planner |
| **Routine marks today** | Operational | Planner |
| **Scheduled time bars** | Context detail | Period view (optional section) |
| **Discover Patterns live** | Exploration | Note |
| **Note list / search** | Capture/browse | Note |

---

## Candidate Home Elements — Decisions

### Mark Calendar

| Question | Decision |
| -------- | -------- |
| First thing visible? | **Second** — after title + frame (words before pixels) |
| First *visual* content? | **Yes** — calendar is the largest visual element |
| Granularity | **Year columns × week rows** (GitHub-style), default **last 3–5 years visible** |
| Lifetime? | **Scroll / pan backward** — no fixed "lifetime" cap in UI copy |
| Month drill? | Click month label or dense cell → **Period: Month** or day → Timeline |
| What cells mean | **Mark presence / mark-type density** (K-30.3 model) — not productivity score |
| Empty state | Quiet grid + *"Marks accumulate here over time."* |

**Rationale:** Calendar is Archive's **signature** — instant continuity without reading copy. Multi-year default distinguishes Home from Note's single-period lenses.

---

### Recent Milestones

| Question | Decision |
| -------- | -------- |
| How many? | **3–5** on Home; link "All milestones →" to Period (year) or filtered Timeline |
| How prominent? | **High** — first content block *below* calendar (or right column on wide screens) |
| Time window | **Last 12 months** rolling, or **most recent 5** globally if sparse |
| Display | Title + date + optional area tag — no scores |
| Primary object? | **Yes** — milestones lead meaning on Home |

---

### Area Entry Points

| Question | Decision |
| -------- | -------- |
| Cards vs pills vs list? | **Pills** (horizontal scroll on mobile) — lightweight, navigational |
| Which areas? | Areas with **marks in last 24 months** (or top 8 by activity); "All areas →" |
| Prominence | **Medium** — below milestones; above period browse |
| Not shown | Areas with zero marks; area progress or completion |

---

### Current Position ("You are here")

| Question | Decision |
| -------- | -------- |
| Needed? | **Yes — compact** |
| Redundant? | Partially — calendar also orients; position line answers *present moment in archive* |
| Form | Single line: `2026 · Q2 · June` + text link **Open this period** |
| Prominence | **Low** — below calendar or inline with browse row; not hero |
| Omit when? | Never — always anchors "now" in historical frame |

---

### Period Browser

| Question | Decision |
| -------- | -------- |
| Home element or separate? | **Compact Home element** — not full year→quarter tree |
| Form | **Browse row**: This Year · This Quarter · This Month · Custom · Areas |
| Full tree | **Period branch** — e.g. opening "This Year" → 2026 with Q1–Q4 |
| Year picker | Secondary control near calendar (jump to 2022, 2026, …) |

---

### Timeline Preview

| Question | Decision |
| -------- | -------- |
| Useful? | **Rarely on Home** |
| Noise? | **Yes** — chronological feed competes with milestones |
| Verdict | **Omit from Home** — enter Timeline from Period, Area, or calendar cell |

---

## Candidate Home Layouts

### Layout A — Calendar Dominant

```
┌──────────────────────────────────────┐
│ Archive · What remains when you      │
│ look back.                           │
├──────────────────────────────────────┤
│                                      │
│     MARK CALENDAR (full width,       │
│     70% viewport height)             │
│                                      │
├──────────────────────────────────────┤
│ Milestones (3) · Areas (pills)       │
│ Browse: Year · Quarter · Month       │
└──────────────────────────────────────┘
```

| Pros | Cons |
| ---- | ---- |
| Strongest continuity signal | Milestones feel secondary |
| Distinct from Note immediately | Sparse users see mostly empty grid |
| Signature Archive identity | Risk of "GitHub contributions" association |

---

### Layout B — Milestone Dominant

```
┌──────────────────────────────────────┐
│ Archive                              │
├──────────────────────────────────────┤
│ RECENT TRANSITIONS                   │
│ · TOEFL 95 (2026-03)                 │
│ · N1 passed (2025-12)                │
│ · K-30 complete (2026-06)              │
├──────────────────────────────────────┤
│ Mark calendar (medium)               │
│ Areas · Browse                       │
└──────────────────────────────────────┘
```

| Pros | Cons |
| ---- | ---- |
| Meaning-first | Weak continuity for new users |
| Story-led | Feels like a list, less "archive room" |
| Strong for rich milestone history | Calendar demoted — loses signature |

---

### Layout C — Wayfinding Minimal

```
┌──────────────────────────────────────┐
│ Archive · Looking back               │
├──────────────────────────────────────┤
│ You are here: 2026 · Q2 · June       │
│ Browse: Year · Quarter · Month · …   │
├──────────────────────────────────────┤
│ Mark calendar (small)                │
│ Milestones (compact) · Areas         │
└──────────────────────────────────────┘
```

| Pros | Cons |
| ---- | ---- |
| Fast navigation for power users | Feels like menu, not archive |
| Low visual weight | Weak emotional "history" hit |
| Easy to implement | Too close to period picker UI |

---

### Layout D — Balanced Hub (recommended)

```
┌──────────────────────────────────────┐
│ Archive                              │
│ What remains when you look back.     │  ← Frame (instant)
├──────────────────────────────────────┤
│                                      │
│   MARK CALENDAR (full width)         │  ← Visual signature
│   3–5 years · jump labels            │
│                                      │
├──────────────────────────────────────┤
│ You are here: 2026·Q2·June  [Open →] │  ← Compact orient
├──────────────────────────────────────┤
│ Recent transitions                   │  ← Meaning
│ ○ TOEFL 95 · 2026-03-15              │
│ ○ K-30 complete · 2026-06-12         │
│ ○ N1 · 2025-12-01                    │
├──────────────────────────────────────┤
│ Concerns  [Japanese][TOEFL][…]       │  ← Area paths
├──────────────────────────────────────┤
│ Browse  Year · Quarter · Month ·     │  ← Period paths
│         Custom · All areas           │
└──────────────────────────────────────┘
```

| Pros | Cons |
| ---- | ---- |
| Frame + calendar + meaning + paths | More sections to design |
| Matches K-30.6 IA | Requires disciplined density |
| Works sparse and rich | Wide-screen layout decisions needed |

---

## Recommended Layout

**Choice: Layout D — Balanced Hub**

### Visual hierarchy (what draws the eye)

| Order | Element | Weight |
| ----- | ------- | ------ |
| 1 | **Title "Archive"** | Large heading — names the room |
| 2 | **Continuity frame** | Subtitle — one sentence, muted |
| 3 | **Mark calendar** | Largest visual mass — continuity proof |
| 4 | **Recent transitions** | First scroll-stop below fold on mobile |
| 5 | **Area pills** | Secondary color, horizontal |
| 6 | **Browse row** | Tertiary — text/button row |
| 7 | **You are here** | Inline, small — or merged with browse row |

On **wide screens:** calendar left (60%), milestones + areas + browse stacked right (40%) — calendar still visible in first five seconds.

### Information hierarchy (what the brain parses)

| Priority | Information type | Source |
| -------- | ---------------- | ------ |
| 1 | **Identity** | "This is the history layer" |
| 2 | **Continuity** | "My life left marks across years" |
| 3 | **Meaning** | "These transitions mattered" |
| 4 | **Concerns** | "These paths are alive in my history" |
| 5 | **Navigation** | "I can go deeper by time or concern" |
| 6 | **Present anchor** | "Now is a point in the archive too" |

Never in top five: activity volume, routine counts, workout stats, schedule hours.

### Navigation hierarchy (where clicks go)

| Home element | Destination |
| ------------ | ----------- |
| Calendar cell (day) | Timeline (day scope) or Period day |
| Calendar month label | Period: Month |
| Calendar year label | Period: Year |
| Milestone row | Period containing date + milestone highlight |
| Area pill | Area view (all time or last 24mo default) |
| You are here → Open | Period: current month or quarter |
| Browse · This Year | Period: current year |
| Browse · This Quarter | Period: current quarter |
| Browse · This Month | Period: current month |
| Browse · Custom | Period: custom picker |
| Browse · All areas | Area index |

**Home never:** opens editor, toggles routine, edits timetable.

---

## What Users Notice First

Ranked by importance in the **first five seconds** (2031 or 2026 user).

| Rank | Notice | Why |
| ---- | ------ | --- |
| **1** | **"Archive" + looking-back frame** | Sets mode before content |
| **2** | **Mark calendar field** | Continuity — "years of life recorded" |
| **3** | **One recognizable milestone** | Meaning — "that phase of my life" |
| **4** | **Familiar area name** | Identity — "Japanese was part of my path" |
| **5** | **Browse / you-are-here** | Wayfinding — optional in first 5s |
| **6** | Area pill colors / layout polish | Aesthetic — not informational |
| **—** | Activity volume, stats | **Should not be noticed** — excluded |

### Multi-year scenario (2031, opening Archive)

Within five seconds the user should understand:

| Understand | Without reading |
| ------------ | --------------- |
| **This is history, not today** | Title + frame |
| **Continuity exists** | Calendar shows 2026–2030+ marks |
| **Life had chapters** | At least one milestone visible |
| **Concerns persisted** | Area pills (Japanese, Absinthe, …) |
| **They can go deeper** | Browse row peripheral vision |

They should **not** understand (because Home must not show):

- How productive 2026 was
- Whether routines were completed
- Whether workouts increased

---

## Relationship to Period / Area / Timeline

### Home as hub — not destination

```
                    ┌──────────────┐
                    │ Archive Home │  ← orient only
                    └───────┬──────┘
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │   Period   │  │    Area    │  │  Timeline  │
     │  (depth)   │  │  (depth)   │  │  (feed)    │
     └────────────┘  └────────────┘  └────────────┘
```

| Branch | Home's job | Branch's job |
| ------ | ---------- | ------------ |
| **Period** | Tease scope + browse shortcuts | Full synthesis: milestones, events, summaries, timeline link |
| **Area** | Show active concern pills | Area × period: linked history, milestones in concern |
| **Timeline** | **No preview** — calendar cells imply chronology | Ordered marks within chosen scope |

### Entry path examples

| User intent | Home interaction | Lands in |
| ----------- | ---------------- | -------- |
| "What was 2026?" | Browse → This Year (or calendar 2026) | Period: 2026 |
| "My Japanese path" | Tap Japanese pill | Area: Japanese |
| "What happened that week?" | Tap calendar cell | Timeline (week/day scope) |
| "What did I achieve lately?" | Tap milestone row | Period + scroll to milestone |
| "Just browsing" | Scroll calendar backward | Stays on Home until click |

### Back navigation

Every Period / Area / Timeline view returns to **Archive Home** — not to Note, not to old Analytics Period Overview.

---

## Sparse vs Rich Home

| State | Home behavior |
| ----- | ------------- |
| **New user (< 30 days)** | Calendar mostly empty; 0–1 milestones; 0–2 areas; frame + browse still establish identity |
| **Active user (1–2 years)** | Calendar shows bands; 3–5 milestones; several area pills |
| **Five-year user** | Calendar full; milestones rotate to recent; areas may include dormant pills behind "All areas" |

**Never:** fake marks, demo data, or motivational empty states.

---

## Mobile vs Desktop

| Concern | Mobile | Desktop |
| ------- | ------ | ------- |
| Calendar | Horizontal scroll years; smaller cells | 3–5 years visible at once |
| Milestones | Below calendar (stack) | Right column beside calendar |
| Area pills | Horizontal scroll | Wrap row |
| Browse | Scrollable chip row | Single row under milestones |

First five seconds on mobile: title + frame + top portion of calendar still visible — milestones may require slight scroll; acceptable.

---

## Success Criteria

**Question:** *If a user opens Archive after five years of use, what should be the very first thing they see?*

**Answer:**

1. **The title Archive** and the line **"What remains when you look back."**
2. Immediately below: the **mark calendar** — a multi-year view of days that left marks, without scores or rankings.
3. Within the first glance: at least **one milestone** that anchors personal meaning (if any exist).

**Not first:** stats, percentages, routines, timetables, note lists, or anything that feels like *measurement*.

**Feeling target:** Opening a **personal archive** — continuity and transitions visible, depth one tap away.

---

## Deferred (K-30.8+ implementation)

| Item | Phase |
| ---- | ----- |
| Replace AnalyticsView with Archive Home layout | K-30.8 |
| Tab rename + icon | K-30.8 |
| Milestone / area data on Home | K-30.8–K-30.9 |
| Multi-year calendar (extend 16-week widget) | K-30.8 |
| Remove operational widgets from shell | K-30.8 |
| Responsive two-column Home | K-30.8 |
| Deep links (`archive://year/2026`) | K-30.9 |

---

## Relationship to Prior Milestones

| Milestone | K-30.7 relationship |
| --------- | ------------------- |
| K-30.6 | Home wireframe refined into Layout D with explicit hierarchy |
| K-30.5 | Home embodies history layer identity |
| K-30.3 | Mark calendar inherits Activity Calendar behavior |
| K-30.1 | Archive tab remains third in nav until rename — Home does not change sidebar |
| K-28 / K-29 | Milestones and areas on Home mirror trace philosophy |

---

*K-30.7 — Home architecture only. Frame the room, show the field of marks, name the transitions, offer the paths.*
