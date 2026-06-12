# Knowledge-30.6 — Archive Information Architecture

## Scope

Information architecture only. **No implementation, no tab rename, no code moves, no UI redesign.**

Builds on [K-30.5 Archive Identity](./Knowledge-30.5-archive-identity.md). K-30.5 defined *what* Archive is; K-30.6 defines *how users navigate it*.

---

## Executive Summary

**First-time Archive question:** *What remains when I look back?*

**First screen answer:** A **continuity-oriented home** — not a period duplicate of Note, not a productivity dashboard. Users see **where they are in time**, **marks across years**, and **paths into depth** (period, area, timeline).

**Recommended IA:** **Candidate D (Hybrid)** with explicit layering:

1. **Archive Home** — landing (mark calendar, year context, entry points)
2. **Period view** — primary drill-down (year → quarter → month → custom)
3. **Area view** — secondary cross-cut (concern × optional period)
4. **Timeline** — tertiary chronological feed within any scope

Period scopes share vocabulary with K-28 Note lenses but Archive Home distinguishes the experience before users choose a period.

---

## Archive Entry Experience

### What users see first (Archive Home)

When a user opens Archive for the first time — or any time without a deep link — they should **not** land in an empty stats dashboard or a clone of Note → This Month.

**Proposed first screen:**

```
┌─────────────────────────────────────────────────────────┐
│  Archive                                                │
│  What remains when you look back.                       │
├─────────────────────────────────────────────────────────┤
│  MARK CALENDAR (multi-year, read-only)                 │
│  Visual rhythm of days with marks · jump to year/month  │
├─────────────────────────────────────────────────────────┤
│  YOU ARE HERE                                           │
│  2026 · Q2 · June          [Open this period →]         │
├─────────────────────────────────────────────────────────┤
│  RECENT TRANSITIONS                                     │
│  Milestones from last ~12 months (titles + dates)       │
├─────────────────────────────────────────────────────────┤
│  CONCERNS WITH MARKS                                    │
│  Area pills: Japanese · TOEFL · Exercise · …            │
├─────────────────────────────────────────────────────────┤
│  BROWSE                                                 │
│  This Year · This Quarter · This Month · Custom · Areas │
└─────────────────────────────────────────────────────────┘
```

### Design intent

| Element | Purpose |
| ------- | ------- |
| **Mark calendar** | Immediate sense of *continuity* — life had rhythm, not performance |
| **You are here** | Orient in calendar time without forcing edit mode |
| **Recent transitions** | Milestones surface *meaning* before raw activity |
| **Concerns with marks** | Areas as **entry points**, not metadata footnotes |
| **Browse row** | Explicit paths for intentional depth |

### First-time user ( sparse data )

Empty or sparse Archive must still communicate identity:

- Mark calendar mostly quiet — neutral copy: *"Marks will accumulate here over time."*
- No nag to plan or optimize
- Link to Note capture only as subtle optional action — Archive is not onboarding

### Returning user ( rich data )

Home acts as **orientation**, not destination. Power users skip quickly to **Period** or **Area** via browse or calendar click.

### Distinction from Note entry

| Note default | Archive Home |
| ------------ | ------------ |
| All Notes / capture | History overview |
| Edit-forward | Read-only |
| Note-native traces | Cross-domain synthesis |
| Working horizon (today, this month) | Retrospective horizon (year, multi-year) |

---

## Navigation Model

### Three axes

Archive navigation operates on three independent axes that can combine:

```
        TIME (Period)
              │
    AREA ─────┼───── TIMELINE (chronological feed)
              │
         (scope intersection)
```

| Axis | Question | Default depth |
| ---- | -------- | ------------- |
| **Period** | What happened in this month/quarter/year? | Primary |
| **Area** | What happened in this concern? | Secondary |
| **Timeline** | What happened in order? | Drill-down within scope |

### Navigation flows

**Flow 1 — Period-first (most common)**

```
Archive Home → This Year → 2026 Q2 → June → [sections] → Open source note
```

**Flow 2 — Calendar jump**

```
Archive Home → Mark calendar cell (2024-03-15) → Day scope → Timeline entries
```

**Flow 3 — Area-first**

```
Archive Home → Japanese (area) → [optional: filter to 2026 Q2] → sections → sources
```

**Flow 4 — Milestone-led**

```
Archive Home → Recent transition → Milestone detail → Period containing it → context
```

### Scope rules

| Rule | Detail |
| ---- | ------ |
| **Single scope active** | Period XOR Area-at-root; intersection when Area view applies period filter |
| **Timeline inherits scope** | Chronological feed always filtered by active period and/or area |
| **No edit in Archive** | All rows link out to Note / Health / Planner |
| **Back stack** | Home ← Period ← Section detail ← Source |

### What moves out of Archive navigation (from current Analytics)

These are **not** Archive destinations — remove from IA when implemented:

| Current widget | Navigation fate |
| -------------- | --------------- |
| Weekly Timetable | Planner |
| Today's Routine Marks | Planner |
| Workout week toggles | Health (Archive links only) |

---

## Archive Hierarchy

### Top-level structure (recommended)

```
Archive
├── Home                          ← default landing
├── Period
│   ├── This Year
│   ├── This Quarter
│   ├── This Month
│   ├── Custom Range
│   └── [Year picker for multi-year jump]
├── Area
│   ├── [Area list — notes with type=area that have archive marks]
│   └── [Area detail × optional period filter]
└── Timeline
    └── [Chronological mark feed — scoped by Period and/or Area]
```

### Period detail page (within scope)

When user opens a period (e.g. **2026 Q2**), sections appear **in priority order** (see Object Priority):

```
2026 Q2
├── 1. Milestones
├── 2. Events
├── 3. Transitions & context (exception days, significant D-Days passed)
├── 4. Areas active in period
├── 5. Activity overview (summarized note marks)
├── 6. Body marks (workout + InBody summary)
├── 7. Timeline (chronological drill-down)
└── [empty state per section — hide when empty]
```

### Area detail page

```
Japanese
├── Period filter: [All time | Year | Quarter | Custom]
├── Milestones (in area)
├── Events (in area)
├── Activity overview (linked notes — summarized)
├── Body marks (if area convention includes exercise — optional future)
└── Timeline (area-scoped)
```

### URL / state model (future implementation hint)

| State key | Example |
| --------- | ------- |
| `archiveView` | `home` \| `period` \| `area` \| `timeline` |
| `periodScope` | `{ kind: 'year', year: 2026 }` |
| `areaId` | note id of area |
| `date` | optional day precision from calendar |

*Documentation only — no routes in K-30.6.*

---

## Candidate Evaluation

### Candidate A — Period First

```
Archive → This Year / Quarter / Month / Custom / Timeline
```

| Strengths | Weaknesses |
| --------- | ---------- |
| Familiar from K-28 Note lenses | Feels like "Note again" without Home differentiation |
| Clear scope semantics | No multi-year orientation at entry |
| Simple IA | Timeline orphaned as peer, not child |

**Verdict:** Strong **drill-down model**, weak **landing**. Adopt as **Period branch**, not root-only.

---

### Candidate B — Timeline First

```
Archive → 2026 → June → May → …
```

| Strengths | Weaknesses |
| --------- | ---------- |
| Strong historical metaphor | Hard to answer "what defined Q2?" |
| Natural for diary-like browsing | Milestones/events buried in noise |
| Good for power users | Poor first-time orientation |

**Verdict:** Adopt as **Timeline drill-down within scope**, not top-level default.

---

### Candidate C — Area First

```
Archive → Japanese / TOEFL / Absinthe / Exercise
```

| Strengths | Weaknesses |
| --------- | ---------- |
| Matches long-term identity concerns | Time becomes secondary — bad for "my 2026" |
| Aligns with K-29 | Cross-domain period review harder |
| Strong for multi-year single concern | Empty areas clutter nav |

**Verdict:** Adopt as **Area branch** with optional period filter, not default landing.

---

### Candidate D — Hybrid

```
Archive Home → Recent Periods · Milestones · Areas · Mark Calendar · Timeline
```

| Strengths | Weaknesses |
| --------- | ---------- |
| Multiple valid paths | Highest design and engineering complexity |
| Home communicates Archive identity | Risk of clutter if every widget shouts equally |
| Supports 2031 → 2026 use case | Requires strict section priority |

**Verdict:** **Recommended.** Home + three branches (Period, Area, Timeline) with shared section vocabulary inside Period and Area views.

---

## Object Priority

Ranked by importance in Archive IA. **Primary** objects define meaning; **secondary** objects add context; **tertiary** objects support drill-down.

### 1. Milestones — **Primary**

| Aspect | Decision |
| ------ | -------- |
| **Rank** | 1 — highest |
| **Role** | Define phases and transitions — the spine of personal history |
| **Primary object?** | **Yes** — the closest Archive has to "chapter headings" |
| **Visibility** | Top of Period view; featured on Home ("Recent transitions") |
| **Volume** | Show all in scope — typically low noise |
| **Not** | Progress %, completion, targets |

**Justification:** Milestones answer *what changed*. Five-year revisit: user remembers phases (exam passed, project shipped), not edit counts.

---

### 2. Events — **Primary**

| Aspect | Decision |
| ------ | -------- |
| **Rank** | 2 |
| **Role** | Time-anchored context — explain why a period looked the way it did |
| **Visibility** | Second section in Period view; inline on Timeline |
| **Volume** | Show all in scope |
| **Relationship to milestones** | Events = occurrences; milestones = boundary markers. Both primary, milestones listed first |

**Justification:** TOEFL exam date, move, trip — events make periods **understandable** without interpretation.

---

### 3. Areas — **Navigation pillar (secondary-primary)**

| Aspect | Decision |
| ------ | -------- |
| **Rank** | 3 |
| **Role** | Cross-cut concern identity over years — not just tags |
| **Navigation?** | **Yes** — top-level Area branch + Home pills + "Areas active in period" section |
| **Metadata?** | **No** — areas are first-class archive paths |
| **Archive pillars?** | **Yes** — one of three axes (with Period and Timeline) |
| **Volume** | List areas with any marks in scope; hide dormant areas in period view |

**Justification:** K-29 areas represent *concerns that leave marks*. Archive must answer *"when was Japanese alive for me?"* — requires Area navigation.

---

### 4. Activity — **Secondary (summarized)**

| Aspect | Decision |
| ------ | -------- |
| **Rank** | 4 |
| **Role** | Evidence that writing/thinking occurred — supports continuity |
| **How much?** | **Overview only** in Archive — counts, notable peaks, linked note titles |
| **Noise threshold** | Do **not** list every edit. Cap Timeline note-activity entries or collapse to daily summaries |
| **Period view** | "Activity overview" — N notes touched, top linked notes by recency |
| **Area view** | Linked notes summary (as K-29 Area lens already shapes) |

**Justification:** Raw activity is essential in **Note** lenses for working. In **Archive**, it becomes noise without summarization. Activity **supports** milestones; it does not replace them.

**Rules:**

| Show | Hide |
| ---- | ---- |
| Notes created in period (count) | Every keystroke / save |
| Meaningful edit days | Edit frequency scores |
| 5–10 representative note links | Full vault listing |

---

### 5. Health records — **Secondary (summary only)**

| Aspect | Decision |
| ------ | -------- |
| **Rank** | 5 |
| **Role** | Body continuity over years — marks, not performance |
| **Workout logs** | **Summary in Period view** — session count, dates; link to Health for detail |
| **Body changes (InBody)** | **Snapshot list or sparse chart** — factual dates/values, no "progress toward goal" |
| **Nutrition history** | **Omit or minimal** — optional factual line if intake logged; no macro optimization |
| **PRs, goals, comparisons** | **Never in Archive** |

**Justification:** Body history matters for *continuity* ("I trained through that winter"). Session-by-session UX belongs in Health. Archive answers *"was the body part of this period?"* not *"did I beat my PR?"*.

---

### Object priority summary

| Rank | Object | Archive role | Period section order |
| ---- | ------ | ------------ | -------------------- |
| 1 | **Milestones** | Chapter headings | §1 |
| 2 | **Events** | Context anchors | §2 |
| 3 | **Areas** | Navigation + "active in period" | §4 (nav) + section |
| 4 | **Activity** | Summarized evidence | §5 |
| 5 | **Health** | Domain summary | §6 |
| — | **Timeline** | Chronological merge of above | §7 / drill-down |
| — | **Planner context** | Exception days, passed D-Days | §3 Transitions |

---

## Multi-Year Use Case

**Scenario:** Year 2031. User opens **Archive → 2026**.

### Immediate understanding (within 5 seconds)

User should grasp:

1. **Which year** they are viewing (2026)
2. **That this year had a shape** — mark calendar or density hint, not empty shell
3. **What defined the year** — 3–5 milestone titles visible without scroll (Home or year header)

### Within first screen / scroll (Period: 2026)

| Priority | Content | Why first |
| -------- | ------- | --------- |
| 1 | **Major milestones** | Phase definitions |
| 2 | **Important events** | Situational context |
| 3 | **Active concerns (areas)** | What mattered to them then |
| 4 | **Significant transitions** | Exception weeks, passed D-Days, moves |
| 5 | **Body continuity summary** | "Training occurred" — session count, InBody snapshots |
| 6 | **Activity rhythm** | Summarized — busy Q2, quiet Q4 — not edit counts |
| 7 | **Quarter breakdown** | Navigate to Q1–Q4 |

### Emotional outcome

> *"That was the year I pushed TOEFL, shipped Absinthe K-28, and trained through the summer"* — assembled from evidence, not from a system narrative.

### What they should not immediately see

- Streaks, grades, completion rates
- Weekly timetable
- Today's operational checklist
- Full note tree

---

## Recommended IA

### Choice: **Hybrid D** with structured layering

Combine candidates as **layers**, not competing homes:

| Layer | Candidate source | Role |
| ----- | ---------------- | ---- |
| **Landing** | D (Home) | Identity + orientation + mark calendar |
| **Primary drill-down** | A (Period) | Year / quarter / month / custom |
| **Secondary cross-cut** | C (Area) | Concern × optional period |
| **Tertiary feed** | B (Timeline) | Chronological within scope |

### Why not A, B, or C alone

| Alone | Failure |
| ----- | ------- |
| A only | Indistinguishable from Note range lenses at entry |
| B only | Milestones and areas buried; overwhelming feed |
| C only | "My 2026" requires awkward area aggregation |

### Why Hybrid D wins

1. **First open** communicates *Archive* — Home is not a period clone
2. **Period path** satisfies familiar K-28 mental model for scoped review
3. **Area path** satisfies K-29 long-concern identity
4. **Timeline** satisfies chronological curiosity without dominating
5. **Mark calendar** — inherited from K-30.3 Activity Calendar — becomes **signature Archive widget** on Home and year views

### IA diagram (final)

```
                    ┌─────────────┐
                    │ Archive Home│
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │   Period   │  │    Area    │  │  Timeline  │
    │ Year/Q/M/  │  │  concern   │  │ (scoped    │
    │  Custom    │  │ × period?  │  │  feed)     │
    └─────┬──────┘  └─────┬──────┘  └─────▲──────┘
          │               │               │
          └───────────────┴───────────────┘
                          │
              ┌───────────▼───────────┐
              │  Period / Area Detail │
              │  1 Milestones         │
              │  2 Events             │
              │  3 Transitions        │
              │  4 Areas active       │
              │  5 Activity (summary) │
              │  6 Body marks (sum)   │
              │  7 Timeline → sources │
              └───────────────────────┘
```

### Relationship to current Analytics shell

| Current (K-30.3) | Future Archive IA |
| ---------------- | ----------------- |
| Period Overview header | Archive Home or Period header |
| Activity This Week | Period summary panel (scoped) |
| Activity Calendar | Mark calendar on Home + year |
| Scheduled Time by Category | Optional period context or move to Planner |
| Exception Days | Transitions section |
| Workout Records grid | Body marks summary + Health link |
| Weekly Timetable | **Remove from Archive IA** → Planner |

---

## Success Criteria

**Question:** *If Absinthe becomes a personal archive after five years of use, how should a user navigate that history?*

**Answer:**

1. **Land on Archive Home** — see continuity (mark calendar) and recent transitions (milestones)
2. **Choose time** (2026) or **concern** (Japanese) or **calendar cell** (specific month)
3. **Read period synthesis** — milestones and events first, areas and summaries second
4. **Drill timeline** if chronological order matters
5. **Open sources** in Note or Health — Archive never traps content

Navigation emphasizes **where you were in life** (period), **what mattered** (area), and **what changed** (milestones/events) — never **how well you performed**.

---

## Deferred to K-30.7+ (implementation)

| Topic | Phase |
| ----- | ----- |
| Tab rename Analytics → Archive | K-30.7 |
| Archive Home layout | K-30.7 |
| Note projection wiring (milestones, events, activity) | K-30.7–K-30.8 |
| Mark calendar multi-year | K-30.8 |
| Remove Planner widgets from shell | K-30.8 |
| Area Archive mode | K-30.9 |
| Shared period picker with Note vs separate component | K-30.7 decision |

---

## Relationship to Prior Milestones

| Milestone | K-30.6 relationship |
| --------- | ------------------- |
| K-30.5 | Identity → structure; Hybrid D refined into Home + branches |
| K-30.4 | Elimination superseded — Archive IA justifies dedicated tab |
| K-30.3 | Activity Calendar → Mark calendar on Home |
| K-28 | Period vocabulary shared; section order follows trace philosophy |
| K-29 | Areas as navigation pillar, not metadata |

---

*K-30.6 — structure only. Archive Home orients; Period and Area deepen; Timeline connects; milestones lead.*
