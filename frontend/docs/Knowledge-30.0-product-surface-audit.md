# Knowledge-30.0 — Product Surface Audit & Navigation Restructure

## Scope

Analysis-only milestone. **No user-facing functionality, no behavior changes, no UI changes, no runtime refactors.**

K-26 (Note-first Entry), K-28 (Daily Trace), and K-29 (Focus Areas) are merged and working. The gap is no longer missing capability — it is **product identity communicated at the front door**.

Evidence base: current `Sidebar.tsx` / `AppContent.tsx` routing, view implementations (`NoteView`, `PlannerView`, `HealthView`, `AnalyticsView`, `RecipeView`), K-28/K-29 philosophy docs, and K-19 workspace/productivity review.

---

## Executive Summary

**When a first-time user sees the sidebar today, they see a productivity dashboard — not a trace-oriented knowledge system.**

| Sidebar tab | Icon signal | Identity communicated |
| ----------- | ----------- | --------------------- |
| Planner | Calendar | Scheduling, tasks, daily ops |
| Health | Dumbbell | Fitness tracking |
| Analytics | BarChart2 | Performance measurement |
| Note | BookOpen | Knowledge (buried 4th) |
| Recipe | BookMarked | Cooking reference (isolated silo) |

Absinthe's stated philosophy — **Capture, Link, Leave Marks, Return, Explore by Time, Explore by Area** — is expressed almost entirely inside **Note**. The other four top-level tabs communicate a different product: planner + tracker + optimizer.

**Core recommendation:** Reorder and restructure navigation so the sidebar answers one question first:

> *"This is where marks are captured, linked, and revisited over time."*

Everything else should be secondary, merged, renamed, or removed until it can be reframed as **trace domains** rather than **productivity modules**.

---

## 1. Current Navigation Map

### App shell (top level)

```
Absinthe
├── Sidebar (primary)
│   ├── Planner      → PlannerView
│   ├── Health       → HealthView
│   ├── Analytics    → AnalyticsView
│   ├── Note         → NoteView
│   ├── Recipe       → RecipeView
│   └── [utility]    Settings · Dark/Light · Out
└── Main content (single active view)
```

**Source:** `TabId = 'planner' | 'health' | 'analytics' | 'settings' | 'note' | 'recipe'` in `Sidebar.tsx`. Settings is bottom utility, not a primary tab.

### Note (strongest philosophy alignment)

```
Note β
├── Browse
│   ├── All Notes
│   ├── Time lenses ─ Today · This Month · This Quarter · This Year · Custom Range
│   ├── Areas
│   ├── Discover Patterns
│   ├── Starred
│   ├── Folders
│   └── Tags
├── Workspace (collapsible)
│   ├── Dashboard
│   ├── Smart Collections
│   ├── Rule Collections
│   ├── Database Views
│   └── Saved Views
├── Trash
└── Editor ─ Edit · Read · Graph · Properties · Relations · …
```

Trace lenses (K-28) and Areas / Discover Patterns (K-29) live here. This is the only section that asks *"What left marks?"* rather than *"How am I performing?"*

### Planner (productivity identity)

```
Planner
├── Routines          (daily habit checkboxes, exception days)
├── To-do list        (date-scoped tasks, separate API)
├── Memo              (embedded lightweight notes — shares Note store)
├── D-Day             (countdown events)
├── Calendar          (month grid, date selection)
└── Timeline          (30-min schedule blocks by category)
```

Mobile sub-tabs: **Planner · Memo · Calendar · Timeline**. D-Day sits under Memo column.

Schedule categories: Study, Work, Workout, Personal, Sleep, Social.

**Data:** API-backed (`/api/routines`, `/api/todos`, schedules). No bridge to Note trace projections (K-28 explicitly out of scope).

### Health (domain traces, separate silo)

```
Health
├── Workout Blocks    (exercise library)
├── Routine Setup     (split templates)
├── Today's Workout   (session log, sets, PR badges)
├── InBody            (Weight, SMM, PBF per date)
└── Protein Tracker   (goal · sources · daily intake)
```

Mobile sub-tabs: **Blocks · Routine · Workout · Protein**.

**Data:** API-backed workouts, body records, nutrition. No wiki links, areas, or trace bridge.

### Analytics (performance dashboard)

```
Analytics
├── Time range ─ Today · Weekly · Monthly · Custom
├── This Week         (workout days, routine %, study hours, Top Focus)
├── Time Distribution (hours by schedule category)
├── Activity          (16-week heatmap)
├── Workout Days      (week toggles)
├── Routine Success   (today's completion %)
├── Today's Detail    (schedule breakdown)
├── Weekly Timetable  (recurring weekly blocks)
└── Exception Days
```

Narrative copy includes: workout streaks, routine on-track / needs-attention warnings, color-coded success thresholds.

**Direct conflict with K-28 anti-goals:** scores, streaks, evaluative narratives, productivity framing.

### Recipe (isolated content silo)

```
Recipes
├── Search + category filters (Korean, Japanese, …)
├── Starred toggle
├── Sort (New / Old / A-Z)
└── Recipe cards (title, ingredients, steps, memo)
```

**Data:** Dedicated `/api/recipes` entity. No backlinks, areas, graph, or trace integration. Structurally different from Note but philosophically similar to *reference material that leaves marks over time*.

---

## 2. Philosophy Alignment Analysis

### Stated philosophy

| Principle | Meaning | Where expressed today |
| --------- | ------- | --------------------- |
| **Capture** | Write things down as they happen | Note editor, Quick Capture (Note); Planner Memo (reduced); Health logs |
| **Link** | Connect ideas through wiki links | Note only |
| **Leave Marks** | Activity becomes historical evidence | Note trace lenses, Areas; Health workout/body logs (separate) |
| **Return** | Revisit past traces without guilt | Note time lenses; **undermined** by Analytics streaks/scores |
| **Explore by Time** | What happened in this day/month/quarter? | Note: Today → Custom Range |
| **Explore by Area** | What left marks in this concern? | Note: Areas, Discover Patterns |

### K-28 guiding question

> Does this help the user see **what left marks**?

### K-28 anti-goals (relevant to surface audit)

| Anti-goal | Current sidebar violation |
| --------- | ------------------------- |
| Productivity dashboard | **Analytics** tab + icon (BarChart2) |
| Streak system | Analytics workout streak copy |
| Habit tracker | Planner Routines as primary tab feature |
| Planner as trace | Planner as **first** sidebar tab |
| Life interpretation engine | Analytics evaluative narratives ("Routine needs attention") |

### First-impression test

A new user landing on default tab order sees:

1. **Planner** — "This is a calendar and task app."
2. **Health** — "This tracks workouts and macros."
3. **Analytics** — "This measures my performance."
4. **Note** — "Oh, there's also notes."

The trace-first identity is **fourth** and visually equal-weight with modules that contradict it.

### Internal tension (K-19 vs K-28)

K-19 recommended productivity orchestration *inside* NoteView (dashboard, tasks, focus presets). K-28/K-29 established trace philosophy *inside* the same view. NoteView therefore carries **both** identities — but at least they coexist in the knowledge layer.

Planner, Health, Analytics, and Recipe carry **only** the older productivity/tracker identity at the app shell level, with no trace vocabulary.

---

## 3. Section-by-Section Audit

### Note

**Verdict: Keep — promote to primary.**

| Aspect | Assessment |
| ------ | ---------- |
| Role | Core product surface |
| Trace alignment | Strong — time lenses, areas, discover patterns, evidence sections |
| Risk | K-19 productivity widgets (dashboard tasks, focus presets) add secondary productivity voice inside an otherwise aligned shell |
| Sidebar position | Should be **first**, not fourth |
| Rename? | Optional. "Note" is accurate but narrow; "Knowledge" or no rename with stronger sub-labels are both viable |

**Keep as top-level.** Consider demoting Workspace Dashboard productivity widgets to secondary over time (K-19 orchestration vs K-28 trace — separate future milestone).

---

### Health

**Verdict: Keep the domain — question top-level prominence.**

| Aspect | Assessment |
| ------ | ---------- |
| Content fit | Workout history, body records, nutrition logs are **long-term traces** — closer to "marks over time" than Planner or Analytics |
| Structural fit | Separate API domain; no links to Note areas or trace projections |
| User mental model | "Body" or "Physical" domain — ongoing concern, not a daily dashboard |
| Top-level? | Defensible as a **trace domain**, but only if reframed away from "tracker" language (PR badges, performance comparison) |

**Evaluation of placement options (no implementation):**

| Option | Pros | Cons |
| ------ | ---- | ---- |
| **A) Remain top-level, rename** (e.g. Body, Physical) | Clear domain; heavy users want fast access | Still a silo; five tabs remain crowded |
| **B) Area specialization** (Exercise / Nutrition areas in Note) | Unified trace model; recipes linkable | Requires data bridge; Health API is rich and structured |
| **C) Secondary under Note** (domain panel / workspace) | Single front door; philosophy-aligned | Deep navigation; loses dedicated fitness UX |
| **D) Dedicated domain under a future "Domains" hub** | Scales for Recipe, Health, etc. | New navigation pattern; more design work |

**Recommendation:** **Keep content, demote from equal top-level prominence** in the short term. Medium term: treat Health as a **trace domain** (not a tracker tab) — either renamed top-level with trace vocabulary, or nested under a "Domains" secondary nav. **Do not** force into Areas until a bridge strategy exists (K-30.x bridge design, not K-30.0).

**Recipe merge candidate:** Nutrition + Recipes share a meal/body concern. See Recipe section.

---

### Recipe

**Verdict: Remove from top-level — merge candidate.**

| Aspect | Assessment |
| ------ | ---------- |
| Isolation | Separate entity, no graph, no areas, no trace |
| Structural difference | Form-based (ingredients, steps) vs block editor — real, but not sufficient for top-level status |
| User value | Reference material revisited over time — philosophically a **trace**, not a productivity module |
| Top-level? | **No** — fifth tab for a niche silo amplifies "collection of mini-apps" perception |

**Evaluation:**

| Option | Verdict |
| ------ | ------- |
| Merge into Health (Nutrition → Recipes) | **Strong candidate.** Health already has Protein Tracker; recipes are nutrition-adjacent reference. Model: `Health → Workout · Body · Nutrition (Protein + Recipes)` |
| Merge into Note (template / database view) | Possible long-term if recipes become notes with structured properties |
| Remain top-level | **Not recommended** |

**Recommendation:** **Remove from primary sidebar.** Short-term: nest under Health as **Nutrition → Recipes**. Long-term: optional Note bridge (recipe notes with `type=recipe` convention) if unified trace is desired.

---

### Planner

**Verdict: Most misaligned top-level tab — decompose.**

| Feature | Trace potential | Productivity alignment | Recommendation |
| ------- | --------------- | ---------------------- | -------------- |
| **Routines** | Medium — recurring marks if reframed as "did I leave a mark today?" not "did I succeed?" | High — checkbox completion, exception stats feed Analytics | **Reframe or demote.** Recurring traces ≠ habit scoring |
| **To-do list** | Low — operational tasks | High — classic productivity | **Demote or bridge to Note task notes** (K-19 direction) |
| **Memo** | Medium — notes, but duplicate of Note tab | Redundant | **Remove** — users have Note |
| **D-Day** | **High** — countdown events map to K-28 events (`type=event`, `eventDate`) | Medium — currently schedule API | **Migrate concept to Note/events**, not Planner branding |
| **Calendar** | Medium — date navigation for traces | High — schedule-centric | **Keep date navigation inside Note trace lenses**; remove as Planner pillar |
| **Timeline** | Low as schedule blocks | High — time-blocking workflow | **Remove or demote heavily** — schedule-centric, not trace-centric |

**Recommendation summary:**

| Action | Items |
| ------ | ----- |
| **Remove from top-level** | Planner as a tab |
| **Migrate** | D-Day → Note events; date picker already in trace lenses |
| **Demote / secondary** | Routines (if kept) as optional recurring-mark log, not primary nav |
| **Merge into Note** | Todos → task notes + dashboard widget (K-19) |
| **Remove** | Memo (duplicate), Timeline (schedule workflow), Calendar as standalone Planner column |

Planner should not be the **first** thing a user sees. If any Planner features survive, they belong in secondary surfaces or future "Capture shortcuts" — not a top-level productivity home.

---

### Analytics

**Verdict: Most philosophically questionable — remove or radically rename/reframe.**

| Current behavior | K-28 violation |
| ---------------- | -------------- |
| Routine Success % | Score |
| Workout streak ("🔥 N-day streak") | Streak system |
| "Routine needs attention" | Evaluative narrative |
| Top Focus category | Performance framing |
| Activity heatmap intensity | Acceptable **if** reframed as "marks density" not "productivity intensity" |

**Evaluation of directions:**

| Direction | Fit | Notes |
| --------- | --- | ----- |
| **Remove entirely** | Strong | Trace lenses in Note already answer "what happened in this period?" |
| **Rename → Review** | Medium | Still risks productivity tone unless content changes |
| **Rename → Reflection** | Medium-Strong | Implies user meaning-making; better than Analytics |
| **Rename → Trace Summary** | **Strong** | Aligns with K-28 vocabulary — but requires **replacing** scores/streaks with evidence sections |
| **Keep as Analytics** | **Reject** | BarChart2 + "Your Analytics" communicates wrong product |

**Recommendation:** **Remove from primary sidebar.** If a summary surface is kept:

1. Rename to **Trace Summary** or fold into Note range lenses (Month/Quarter/Year already aggregate activity).
2. Replace metrics with evidence: milestones, events, activity overview — same sections as range trace projection.
3. Migrate Weekly Timetable to a secondary planning tool (or remove) — it is schedule infrastructure, not trace review.

Most Analytics widgets duplicate or contradict what Note trace lenses should provide. **Default path: merge into Note time lenses, delete Analytics tab.**

---

## 4. Recommendations Summary

### Keep

| Item | Level | Notes |
| ---- | ----- | ----- |
| **Note** | Primary top-level | First sidebar position; core product |
| **Health domain content** | Top-level or secondary | Workout, body, nutrition traces — reframe, don't delete |
| **Trace lenses** (Today → Custom Range) | Inside Note | Already correct |
| **Areas + Discover Patterns** | Inside Note | Already correct |
| **Settings, theme, auth** | Utility | Unchanged |

### Merge

| From | Into | Rationale |
| ---- | ---- | --------- |
| **Recipe** | **Health → Nutrition** | Shared body/meal domain; reduces silo count |
| **Analytics evidence** | **Note range lenses** | Same questions, trace-aligned UI |
| **Planner Memo** | **Note** | Duplicate surface |
| **Planner D-Day** | **Note events** (K-28 convention) | Events are marks, not planner features |
| **Planner Todos** | **Note task notes** (K-19) | Single content entity |

### Rename

| Current | Candidate | Rationale |
| ------- | --------- | --------- |
| Analytics | **Trace Summary** (if kept at all) | Or eliminate tab |
| Health | **Body** or keep **Health** | Less "tracker" if copy reframed |
| Note | Keep **Note** or **Knowledge** | Note is fine if it's first and clearly primary |
| Planner | *(tab removed)* | Residual features get domain-specific names |

### Remove (from primary navigation)

| Item | Rationale |
| ---- | --------- |
| **Planner** (as top-level tab) | Wrong first impression; decompose features |
| **Analytics** (as top-level tab) | K-28 anti-goals; redundant with trace lenses |
| **Recipe** (as top-level tab) | Niche silo; merge into Health |
| **Timeline** (Planner sub-feature) | Schedule-centric, not trace-centric |
| **Memo** (Planner sub-feature) | Duplicate of Note |

### Demote to secondary

| Item | Secondary placement |
| ---- | ------------------- |
| Routines | Optional capture shortcut or Health/Body sub-section — not app home |
| Weekly Timetable | Settings or advanced planning — not trace review |
| Workspace Dashboard (productivity widgets) | Collapsed by default inside Note |
| Database views / templates | Power-user layer inside Note (already is) |

---

## 5. Candidate Future Navigation Structures

### Option A — Trace-first minimal (recommended direction)

```
Sidebar (primary)
├── Note              ← default landing, first tab
│   ├── Capture (All Notes, Quick Capture)
│   ├── Explore by Time (Today … Custom Range)
│   ├── Explore by Area (Areas, Discover Patterns)
│   └── [Workspace]   ← collapsed: Dashboard, DB views, collections
├── Body              ← renamed Health; Workout · Records · Nutrition (incl. Recipes)
└── [Settings · Theme · Out]
```

**Removed from shell:** Planner, Analytics, Recipe (top-level).

**First impression:** "Write and revisit marks" → "Body domain for physical traces."

---

### Option B — Two-tier (Knowledge + Domains)

```
Sidebar
├── Knowledge         ← Note + trace lenses (rename optional)
└── Domains           ← flyout or second column
    ├── Body          ← Health + Recipes
    └── [future domains]
```

**Removed:** Planner, Analytics as tabs. Residual Planner features only if rebuilt as domain tools.

---

### Option C — Note-only shell (maximal philosophy alignment)

```
Sidebar
├── Note
└── [Settings]
```

All domain content (Health, Recipes) accessed via **Areas** (`[[Exercise]]`, `[[Nutrition]]`) + dedicated panels inside Note, or deep links from area lenses.

**Pros:** Single product identity. **Cons:** Requires significant data bridges; Health structured UX is hard to nest.

**Verdict:** Aspirational long-term; Option A is the pragmatic K-30.x target.

---

### Option D — Status quo (not recommended)

Five equal tabs: Planner · Health · Analytics · Note · Recipe.

**Fails the first-impression test.** Conflicts with K-28/K-29 merged work.

---

## 6. Migration Path

Phase 0 (this document): **decision only** — no code.

### Phase 1 — Surface reorder & rename (low risk)

| Change | Type | User impact |
| ------ | ---- | ----------- |
| Move Note to first sidebar position | Reorder | Immediate identity shift |
| Hide or collapse Analytics tab | Remove primary | Stops advertising measurement |
| Hide Recipe tab; link from Health | Merge nav | One less silo visible |

No data migration. Feature flags or nav config sufficient.

### Phase 2 — Reframe remaining tabs (medium risk)

| Change | Type |
| ------ | ---- |
| Rename Health → Body (optional) | Label + copy pass |
| Remove Analytics scores/streaks OR redirect tab to Note range lens | UX + routing |
| Nest Recipes under Health/Nutrition | View routing only |
| Remove Planner tab; keep routines/todos accessible via Note dashboard widgets | Nav + deep links |

API boundaries unchanged. Planner/Health data stays where it is.

### Phase 3 — Conceptual migration (high effort, future milestones)

| Change | Depends on |
| ------ | ---------- |
| D-Day → Note events | K-28 event convention UX |
| Todos → task notes | K-19 task bridge |
| Health logs → trace projections | Domain bridge design (K-30.x+) |
| Recipes → notes with `type=recipe` | Schema/convention decision |
| Routines as recurring marks in trace | K-28 scope expansion |

Each Phase 3 item is its own milestone. K-30.0 does not prescribe implementation.

### What not to migrate yet

- Do not delete API endpoints or user data.
- Do not force Health into Areas without a bridge model.
- Do not rebuild Timeline as trace — schedule blocks are a different concern.
- Do not add new entities to "fix" navigation.

---

## 7. Decision Checklist (K-30.0 outputs)

Use this checklist before K-30.1+ implementation:

- [ ] **Default landing tab** is Note (or Knowledge), not Planner
- [ ] **Primary sidebar count** ≤ 2–3 items (Note + optional domain + settings)
- [ ] **Analytics tab** removed or replaced with trace-aligned summary inside Note
- [ ] **Recipe** no longer a top-level tab
- [ ] **Planner tab** removed; residual features have explicit homes
- [ ] **Copy audit** — no streaks, scores, or "needs attention" in primary surfaces
- [ ] **First-impression test** passed with 3 fresh users: "What is this app for?"

---

## 8. Relationship to Prior Milestones

| Milestone | Relationship |
| --------- | ------------ |
| **K-26** | Note-first entry — correct direction; undermined by sidebar order |
| **K-28** | Trace lenses implemented in Note; Analytics tab contradicts anti-goals |
| **K-29** | Areas in Note sidebar — model for how domains *should* feel |
| **K-19** | Productivity inside Note is acceptable orchestration; productivity *as app shell* is not |

---

## Appendix — Alignment Matrix

| Surface | Capture | Link | Leave Marks | Return | Explore Time | Explore Area | First-impression fit |
| ------- | ------- | ---- | ----------- | ------ | ------------ | ------------ | -------------------- |
| Note | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Strong** |
| Health | ✓ | ✗ | ✓ | partial | partial | ✗ | Medium (tracker tone) |
| Recipe | ✓ | ✗ | partial | partial | ✗ | ✗ | Weak (silo) |
| Planner | partial | ✗ | partial | ✗ | partial | ✗ | **Misaligned** |
| Analytics | ✗ | ✗ | partial | ✗ | partial | ✗ | **Misaligned** |

---

*K-30.0 — analysis only. We are deciding what Absinthe is before deciding what to build next.*
