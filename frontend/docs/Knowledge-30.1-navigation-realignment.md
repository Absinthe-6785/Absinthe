# Knowledge-30.1 — Navigation Realignment

## Scope

Navigation and product-identity alignment only. **No feature removal, no data migration, no page redesign.**

Builds on [K-30.0 Product Surface Audit](./Knowledge-30.0-product-surface-audit.md).

**Runtime change in K-30.1:** primary sidebar tab order only (`Sidebar.tsx`).

---

## Executive Summary

K-30.0 found that sidebar order communicated *Plan → Track → Optimize* while the actual product lives in **Note** (capture, traces, areas, discovery).

K-30.1 reorders the shell so the first tab a user sees is **Note**, matching the default landing tab (`AppContent` already opens on `note`). Legacy modules remain fully functional but are visually demoted in prominence.

**Success test:** A first-time user should reasonably conclude:

> *"This is a place to capture, revisit, and explore what matters."*

Not:

> *"This is primarily a productivity dashboard."*

---

## Before

### App shell (pre-K-30.1)

```
Sidebar (top → bottom on desktop)
├── Planner      ← first tab (Calendar icon)
├── Health
├── Analytics
├── Note         ← fourth tab despite being default landing
├── Recipe
└── [utility]    Settings · Theme · Out
```

### Default entry

| Behavior | Value |
| -------- | ----- |
| `activeTab` initial state | `'note'` (unchanged since K-26) |
| First visible sidebar tab | **Planner** (mismatch) |

### Identity communicated

```
Plan        (Planner — first in nav)
  ↓
Track       (Health)
  ↓
Optimize    (Analytics)
  ↓
Also: Note, Recipe
```

---

## After

### App shell (K-30.1)

```
Sidebar (top → bottom on desktop)
├── Note         ← first tab (BookOpen icon) — PRIMARY
├── Health
├── Analytics
├── Planner      ← demoted from first to fourth
├── Recipe       ← last primary tab (lowest prominence)
└── [utility]    Settings · Theme · Out
```

**Implementation:** `Sidebar.tsx` — `PRIMARY_TABS` order `['note', 'health', 'analytics', 'planner', 'recipe']`.

### Default entry (unchanged)

| Behavior | Value |
| -------- | ----- |
| `activeTab` initial state | `'note'` |
| First visible sidebar tab | **Note** (aligned) |

### Identity communicated

```
Capture     (Note — first in nav + default view)
  ↓
Leave Marks (Note traces; Health body logs)
  ↓
Return      (Note time lenses; revisit without scoring in Note)
  ↓
Explore     (Areas · Discover Patterns inside Note)
```

Legacy tabs remain reachable but no longer define first impression.

---

## Rationale

### Why Note first

Note is the only top-level destination that implements K-28/K-29 philosophy end-to-end:

| Capability | Location |
| ---------- | -------- |
| Capture | Note editor, Quick Capture |
| Link | Wiki links, graph, relations |
| Leave Marks | Trace activity, events, milestones |
| Return | Today → Custom Range lenses |
| Explore by Area | Areas sidebar, Area Lens |
| Discovery | Discover Patterns (observations, not recommendations) |

Promoting Note in the sidebar aligns **visual hierarchy** with **default behavior** and **merged product work** (K-26, K-28, K-29).

### Why Health stays second

Health content (workouts, body records, nutrition) behaves as **long-term traces** — closer to "marks over time" than Planner or Analytics. Keeping it near the top acknowledges a real domain without claiming it is the product core.

Future phases may rename or nest Health; K-30.1 only adjusts order.

### Why Analytics stays third (for now)

Analytics remains functional but is **philosophically misaligned** (see Legacy Product Signals). Third position reduces its identity-defining role while avoiding removal. K-30.2+ will address copy and eventual merge into Note trace summaries.

### Why Planner moves to fourth

Planner was the strongest productivity signal (Calendar icon, first position). Demoting it to fourth preserves all features (routines, todos, memo, calendar, timeline, D-Day) while stopping it from defining Absinthe's front door.

### Why Recipe stays last

Recipe is a niche, isolated silo. Last position minimizes competition with Note as primary surface. Full integration path documented below; no migration in this phase.

---

## Navigation Label Audit

Labels reviewed at top level and in key sub-surfaces. **No renames applied in K-30.1** unless noted as safe deferred.

### Top-level sidebar

| Label | EN (i18n key) | User expectation | Actual behavior | K-28/K-29 alignment | Rename safe? |
| ----- | ------------- | ---------------- | --------------- | ------------------- | ------------ |
| **Note** | `note` → "Note" | Generic notes app | Full knowledge system: editor, traces, areas, workspace | **Strong** — core product | Optional: "Knowledge" — defer; "Note" is accurate |
| **Health** | `health` → "Health" | Fitness / wellness tracker | Workout logs, InBody, protein tracking | Medium — traces, but tracker tone (PR badges, goals) | Defer — "Body" candidate in K-30.2 |
| **Analytics** | `analytics` → "Analysis" (ja) | Performance dashboard, KPIs | Routine %, streaks, heatmap, weekly review | **Conflicts** — scores, streaks, evaluative copy | Defer — "Trace Summary" needs content change first |
| **Planner** | `planner` → "Planner" | Calendar, tasks, schedule | Routines, todos, memo, timeline, D-Day | **Conflicts** as primary identity | Defer — tab may be removed/demoted further later |
| **Recipe** | `recipe` → "Recipe" | Cookbook | Structured recipe CRUD (API silo) | Neutral — reference material, not trace-integrated | Defer — nest under Health in K-30.3+ |

### Note sub-navigation (unchanged — reference)

| Label | Alignment | Notes |
| ----- | --------- | ----- |
| All Notes | ✓ Capture | Default browse |
| Today / This Month / … / Custom Range | ✓ Explore by Time | K-28 trace lenses |
| Areas | ✓ Explore by Area | K-29 |
| Discover Patterns | ✓ Discovery | "Observations — not recommendations" |
| Starred, Folders, Tags | ✓ Organization | Standard PKM |
| Workspace / Dashboard | Partial | K-19 productivity orchestration — secondary voice |

### Icons (visual semantics)

| Tab | Icon | Signal | K-30.1 action |
| --- | ---- | ------ | ------------- |
| Note | BookOpen | Reading / writing | **First** — aligned |
| Health | Dumbbell | Fitness tracking | Unchanged |
| Analytics | BarChart2 | Measurement | Unchanged — icon change deferred to K-30.2 |
| Planner | Calendar | Scheduling | Demoted in order only |
| Recipe | BookMarked | Reference collection | Last position |

---

## Legacy Product Signals (Documented — Not Rewritten)

Occurrences that imply productivity scoring, optimization, or performance evaluation. **No copy changes in K-30.1.**

### AnalyticsView — high severity (K-28 anti-goals)

| Location | Copy / behavior | Signal type |
| -------- | --------------- | ----------- |
| Page title | `Your Analytics` (`yourAnalytics`) | Measurement framing |
| Weekly narrative | `🔥 N-day workout streak` | Streak system |
| Weekly narrative | `✅ Routine on track` | Performance evaluation |
| Weekly narrative | `⚠️ Routine needs attention` | Guilt / judgment |
| Weekly narrative | `✅ Perfect routine week` | Success scoring |
| Weekly narrative | `💪 Strong workout week` / `😴 No workouts yet` | Evaluative narrative |
| This Week card | Routine % with red/amber/green thresholds | Completion scoring |
| This Week card | `Top Focus` + category % | Optimization framing |
| Activity heatmap | Internal `score` 0–4 from workout/routine/study | Productivity intensity |
| Heatmap legend | `Less` … `More` | Performance gradient |
| Routine Success | `Today's Routine Rate` + % bar | Habit success metric |
| Study card | `avg Xh/day` | Efficiency metric |

**File:** `frontend/src/components/views/AnalyticsView.tsx`

### PlannerView — medium severity

| Location | Copy / behavior | Signal type |
| -------- | --------------- | ----------- |
| Routines | Daily checkbox completion | Habit tracking |
| i18n `exceptionDesc` | "excluded from **completion stats**" | Stats framing |
| i18n `routineRate` | "Routine **completion**" | Completion metric |
| To-do list | Task completion workflow | Productivity ops |
| Timeline | Time-blocking schedule | Plan-first workflow |

**Files:** `PlannerView.tsx`, `i18n.ts`

### HealthView — medium severity (domain-appropriate but tracker-toned)

| Location | Copy / behavior | Signal type |
| -------- | --------------- | ----------- |
| Workout sets | `PR 🏆` badge on personal records | Performance celebration |
| Protein Tracker | `Daily Goal`, goal types (Muscle / Fat / …) | Target optimization |
| Previous session comparison | Max weight vs prior | Progress evaluation |

**File:** `HealthView.tsx`

**Note:** Health signals are acceptable for a **body domain** if reframed as traces; they conflict only when Health is mistaken for the *core product identity*.

### NoteView / Workspace — low severity (secondary, inside aligned shell)

| Location | Copy / behavior | Signal type |
| -------- | --------------- | ----------- |
| WorkspaceDashboardView | "Your **productivity** entry point" | Productivity framing |
| Dashboard widgets | Quick task / journal creation | K-19 orchestration |
| Formula columns | User-defined `completionRate`, `score` | User-owned metrics — not system judgment |
| Related notes | Internal `score` for ranking | Graph relevance — not life evaluation |

**Files:** `WorkspaceDashboardView.tsx`, knowledge query/formula layers

### Trace-aligned copy (positive reference)

| Location | Copy | Why it fits |
| -------- | ---- | ----------- |
| Discover Patterns footer | "N observations — meaning belongs to you" | K-28 principle |
| Area lens empty state | "No traces linked to this area yet" | Evidence, not evaluation |
| Daily trace empty | "No traces recorded for this day" | Neutral, no nag |

---

## Recipe Visibility Review

### Current state

- Top-level sidebar tab (was 5th; K-30.1 moves to **last** among primary tabs)
- Dedicated `RecipeView` with category filters, starred, sort
- API entity separate from notes — no graph, areas, or trace bridge

### Assessment

| Criterion | Finding |
| --------- | ------- |
| Competes with Note? | **Yes** — equal-weight tab implied parallel product surface |
| User need | Valid — structured cooking reference |
| Philosophy fit | Reference material revisited over time; belongs as **domain**, not **peer to Note** |
| K-30.1 action | **Lower prominence** via sort order only |

### Future integration path (deferred)

```
Health (or Body)
└── Nutrition
    ├── Protein Tracker  (existing)
    └── Recipes          (migrated nav entry)
```

Alternative long-term: `type=recipe` note convention with structured properties — requires data bridge (K-30.3+).

**K-30.1:** Recipe remains fully functional; last sidebar position reduces visual competition with Note.

---

## Planner Visibility Review

### Current state

- Was **first** sidebar tab — strongest productivity signal
- Calendar icon reads as "schedule app home"
- Default entry was already Note (hidden mismatch)

### Sub-features vs philosophy

| Feature | Primary signal | K-30.1 placement |
| ------- | -------------- | ---------------- |
| Routines | Habit completion | Functional — fourth tab |
| To-do list | Task management | Functional — fourth tab |
| Memo | Lightweight notes | Functional — duplicates Note partially |
| Calendar | Date navigation | Functional — Note trace lenses also navigate dates |
| Timeline | Time blocking | Functional — schedule-centric |
| D-Day | Countdown events | Functional — K-28 event migration candidate (future) |

### K-30.1 actions

| Action | Applied |
| ------ | ------- |
| Remove Planner | **No** — out of scope |
| Demote nav position | **Yes** — fourth tab |
| Change default entry | **No change needed** — already `note` |
| Reduce icon prominence | **No** — order change only; icon treatment deferred |

### Residual identity risk

Planner at position four is still one tap away. Users who explore all tabs will still see productivity workflows. Full decomposition is deferred to K-30.2+.

---

## Deferred

Items intentionally postponed to later K-30.x phases:

| Item | Target phase | Reason |
| ---- | ------------ | ------ |
| Planner decomposition (D-Day → events, todos → task notes, remove Memo/Timeline) | K-30.2+ | Requires UX + data bridge design |
| Analytics redesign or removal | K-30.2+ | Copy rewrite + possible merge into Note range lenses |
| Analytics rename (`Trace Summary`) | K-30.2+ | Rename without content change would be misleading |
| Recipe → Health integration | K-30.3+ | Nav nesting + optional data model |
| Health rename (`Body`) + trace vocabulary | K-30.2+ | Copy pass across HealthView |
| Analytics icon change (BarChart2 → neutral) | K-30.2+ | Visual identity pass |
| Workspace Dashboard productivity copy | K-30.2+ | Secondary surface inside Note |
| Sidebar tab count reduction (hide Analytics/Recipe) | K-30.2+ | K-30.1 uses order only per scope |
| Domain data bridges (Health ↔ Note traces) | K-30.4+ | Architecture milestone |

---

## Implementation Checklist (K-30.1)

- [x] Sidebar order: Note · Health · Analytics · Planner · Recipe
- [x] Default landing: Note (pre-existing)
- [x] Label audit documented
- [x] Legacy product signals inventoried
- [x] Recipe visibility reviewed
- [x] Planner visibility reviewed
- [ ] Copy rewrites (deferred)
- [ ] Tab removal / nesting (deferred)
- [ ] Data migration (deferred)

---

## Relationship to Prior Milestones

| Milestone | K-30.1 relationship |
| --------- | ------------------- |
| K-26 | Note-first entry — sidebar now matches |
| K-28 | Trace lenses preserved; Analytics conflicts documented for later |
| K-29 | Areas / Discover unchanged |
| K-30.0 | Audit recommendations — Phase 1 (reorder) applied |

---

*K-30.1 — navigation alignment only. Functionality preserved; identity corrected at the shell.*
