# Knowledge-30.9 — Archive Home Implementation Plan

## Scope

Implementation roadmap only. **No UI, no route changes, no tab rename, no projection code in this milestone.**

Builds on [K-30.5](./Knowledge-30.5-archive-identity.md) · [K-30.6](./Knowledge-30.6-archive-information-architecture.md) · [K-30.7](./Knowledge-30.7-archive-home-architecture.md) · [K-30.8](./Knowledge-30.8-archive-home-projection-model.md).

**Success criterion:** If implementation starts tomorrow, the team can follow this plan to move from current `AnalyticsView` to Archive Home with minimal risk, maximum reuse of K-28/K-29 trace infrastructure, and no regression of the evidence-first philosophy from K-30.3.

---

## Executive Summary

Archive Home is a **read-only orientation layer** — not a refactor of Analytics widgets. The safest path is **projection-first, shell-second, widgets-third, migration-last**.

| Phase | Milestone | Delivers |
| ----- | --------- | -------- |
| 1 | K-30.10 | Pure projection layer + tests + backend mark API extension |
| 2 | K-30.11 | Archive internal navigation shell (inside existing tab) |
| 3 | K-30.12–K-30.15 | Home sections as dumb renderers of `ArchiveHomeProjection` |
| 4 | K-30.16 | Archive Home becomes default landing; Analytics widgets hidden |
| 5 | K-30.17+ | Operational widgets removed; Period / Area / Timeline branches |
| 6 | K-30.21 | Tab rename Analytics → Archive (sidebar + i18n) |

**Recommended first PR:** K-30.10 projection layer only — zero user-visible change, full test coverage, unblocks all UI work.

**Key architectural decision:** Evolve `AnalyticsView` into an Archive shell via **incremental extraction**, not a parallel `ArchiveView` rewrite. Keep `activeTab === 'analytics'` until the final rename phase.

---

## Existing Assets Audit

Inventory of current Analytics (`frontend/src/components/views/AnalyticsView.tsx` — ~720 lines, zero sub-components) classified for Archive migration.

### Architecture today

| Layer | Location | Archive relevance |
| ----- | -------- | ----------------- |
| View | `AnalyticsView.tsx` | Monolith — all widgets inline |
| Props | `AnalyticsProps` | Planner/schedule data only — **no notes vault** |
| Routing | `AppContent.tsx` → `activeTab === 'analytics'` | Unchanged until rename phase |
| Data | SWR + `/api/heatmap`, `/api/schedules/range`, `/api/workouts/range`, `/api/routine_exceptions`, `/api/weekly_schedules` | Domain marks only; notes come from separate store |
| Trace projections | `features/knowledge/trace/` | Used by Note only — **not wired to Analytics** |

### Widget classification

| # | Widget | Lines (approx) | Verdict | Archive fate |
| - | ------ | -------------- | ------- | ------------ |
| 1 | Page header — "Period Overview" + date range | 274–306 | **ADAPT** | Period branch header only; **not** Archive Home frame |
| 2 | Time range control (Today · Weekly · Monthly · Custom) | 281–305 | **ADAPT** | Period branch scope picker; align labels with Note lenses (Month / Quarter / Year / Custom) |
| 3 | Activity This Week summary grid | 312–367 | **REMOVE** (from tab) | Factual counts belong in **Period branch** summary if anywhere — **never on Home** |
| 4 | Scheduled Time by Category | 369–394 | **REMOVE** (from tab) | Planner operational context; optional Period § context later |
| 5 | Exception Days collapsible list | 396–420 | **ADAPT** | Period branch § Transitions; not Home |
| 6 | Activity Calendar (16-week heatmap) | 422–497 | **ADAPT** | **Core reuse** → `ArchiveMarkCalendar`; extend span, merge note marks via projection |
| 7 | Workout Records week grid + toggles | 499–539 | **REMOVE** (from tab) | Health operational UX; Archive Period gets summary + link only |
| 8 | Today's Routine Marks | 541–560 | **REMOVE** (from tab) | Planner — today's execution |
| 9 | Today's Schedule (daily range only) | 561–594 | **REMOVE** (from tab) | Planner — today's execution |
| 10 | Weekly Timetable + CRUD modal | 597–715 | **REMOVE** (from tab) | Planner — full planning surface |

### Reusable logic (module-level, not widgets)

| Asset | Location | Verdict | Maps to |
| ----- | -------- | ------- | ------- |
| `HeatmapDay` type | `AnalyticsView.tsx:32–39` | **ADAPT** | `ArchiveDomainMarkDay` (K-30.8) |
| `getMarkLevel()` | `AnalyticsView.tsx:42–49` | **ADAPT** | `domainMarkDayToTypes` + `computeMarkDensity` in projection — extend with note mark types |
| `formatHeatmapTooltip()` | `AnalyticsView.tsx:51–58` | **ADAPT** | UI tooltip formatter — move to `ArchiveMarkCalendar` props; include note mark types |
| Heatmap grid algorithm (weeks, month labels, cell colors) | `AnalyticsView.tsx:423–497` | **ADAPT** | Extract to `ArchiveMarkCalendar`; feed from `ArchiveMarkCalendarProjection` not inline SWR |
| `weeklyReview` aggregation | `AnalyticsView.tsx:252–270` | **REMOVE** | Period summary candidate — not Home |
| `computedStats` / category bars | `AnalyticsView.tsx:210–232, 369–394` | **REMOVE** (from tab) | Planner |
| `CATEGORY_META` icons | `AnalyticsView.tsx:13–20` | **REMOVE** (from Archive) | Planner / Period optional |
| SWR + `fetcher` pattern | Throughout | **KEEP** | Reuse in `useArchiveDomainMarks` hook |
| Card chrome (`theme.card`, rounded corners) | Throughout | **KEEP** | Shared visual language for Archive sections |
| `ConfirmModal` / weekly schedule CRUD | `AnalyticsView.tsx:659–715` | **REMOVE** | Moves with Timetable to Planner |

### Backend assets

| Endpoint | Current limit | Verdict | Archive need |
| -------- | ------------- | ------- | ------------ |
| `GET /api/heatmap` | 112 days fixed (`backend/main.py` → `get_heatmap`) | **ADAPT** | Parameterized date range → `GET /api/archive_marks?start_date=&end_date=` |
| `GET /api/schedules/range` | Used by Analytics | **REMOVE** (from Archive tab) | Period branch optional |
| `GET /api/workouts/range` | Workout week grid | **REMOVE** (from Archive tab) | Period body-marks summary |
| `GET /api/routine_exceptions` | Exception Days | **ADAPT** | Period Transitions section |
| Weekly schedules CRUD | Timetable | **REMOVE** (from Archive tab) | Planner |

### K-28 / K-29 assets (reuse, not in Analytics today)

| Asset | Path | Reuse in Archive Home |
| ----- | ---- | --------------------- |
| `buildDailyTraceProjection` | `trace/buildDailyTraceProjection.ts` | Single-day validation; activity mark rules |
| `buildRangeTraceProjection` + lens helpers | `trace/buildRangeTraceProjection.ts` | Period branch; `currentTraceMonth/Quarter/Year`, `enumerateDateKeys` |
| `RangeTraceLensView` | `trace/RangeTraceLensView.tsx` | Period branch UI — adapt chrome, not logic |
| `AreaTraceView` | `trace/AreaTraceView.tsx` | Area branch UI |
| `buildAreaTraceProjection` | `trace/buildAreaTraceProjection.ts` | Area branch depth |
| `listAreaNotes`, `resolveAreaMembership` | `trace/areaNotes.ts`, `buildAreaTraceProjection.ts` | Area pills |
| `isMilestoneNote`, `readMilestoneFromNote` | `trace/milestoneNotes.ts` | Recent milestones |
| `isEventNote`, `readEventFromNote` | `trace/eventNotes.ts` | Mark calendar note-side scan |
| `TraceMilestoneRef`, `TraceRangeLens` | `trace/*Models.ts` | Navigation ref bridging |
| `useNotesStore` | `store/useNotesStore.ts` | Notes input — **new dependency for Analytics tab** |

### Summary counts

| Verdict | Widgets | Logic modules |
| ------- | ------- | ------------- |
| **KEEP** | 0 (none drop-in) | SWR pattern, theme card styling |
| **ADAPT** | 4 (header/range, heatmap, exception days, period controls) | `getMarkLevel`, tooltip, grid algorithm, heatmap API |
| **REMOVE** | 6 (weekly summary, time distribution, workout grid, routine marks, today schedule, timetable) | `weeklyReview`, `computedStats`, CRUD modals |

---

## Component Plan

### Design constraints (from K-30.7 Layout D)

Archive Home renders **only** `ArchiveHomeProjection` fields. No secondary aggregation in components. No scores, streaks, KPIs, or operational affordances.

### Recommended structure: Option C — Shell + Home sections

**Rejected alternatives:**

| Option | Structure | Why rejected |
| ------ | --------- | ------------ |
| A | Single `ArchiveHomeView` monolith (~400 lines) | Repeats Analytics anti-pattern; hard to test sections independently |
| B | One component per projection field, flat under `views/` | No navigation container for Period / Area branches |
| **C (recommended)** | `ArchiveShell` → branch views → section components | Matches K-30.6 IA; enables incremental migration inside `AnalyticsView` |

### Proposed file tree

```
frontend/src/components/views/
├── AnalyticsView.tsx                    # Phase 1: unchanged
│                                        # Phase 4+: thin re-export or ArchiveShell wrapper
└── features/archive/
    ├── index.ts
    ├── archiveNavigationModels.ts       # archiveView: home | period | area | timeline
    ├── ArchiveShell.tsx                 # Internal nav state, projects hook, branch routing
    ├── hooks/
    │   ├── useArchiveHomeProjection.ts  # SWR domain marks + useMemo buildArchiveHomeProjection
    │   └── useArchiveDomainMarks.ts     # /api/archive_marks fetch
    └── home/
        ├── ArchiveHomeView.tsx          # Layout D orchestrator
        ├── ArchiveFrame.tsx             # frame.title + frame.subtitle
        ├── ArchiveMarkCalendar.tsx      # ADAPT from Analytics heatmap block
        ├── ArchiveYouAreHere.tsx        # Compact orient line + "Open this period"
        ├── ArchiveRecentMilestones.tsx  # List of ArchiveMilestoneEntry
        ├── ArchiveAreaPills.tsx         # Horizontal pill row + "All areas →"
        ├── ArchiveBrowseLinks.tsx     # Year · Quarter · Month · Custom · Areas
        └── ArchiveEmptyState.tsx        # Sparse vault hints from empty.* flags
```

### Section components — responsibilities

| Component | Projection input | Renders | Navigation emits |
| --------- | ---------------- | ------- | ---------------- |
| `ArchiveFrame` | `frame` | Title + subtitle | — |
| `ArchiveMarkCalendar` | `markCalendar` | Multi-year grid, month/year labels, legend | `onDayClick(date)`, `onMonthClick(year, month)`, `onYearClick(year)` |
| `ArchiveYouAreHere` | `youAreHere` | `labels.combined` + open period link | `onOpenPeriod(youAreHere.openPeriod)` |
| `ArchiveRecentMilestones` | `recentMilestones` | 3–5 rows: label + date | `onMilestoneClick(entry)` → Period |
| `ArchiveAreaPills` | `areaPills` | Pills sorted by recency | `onAreaClick(areaRef)`, `onAllAreas()` |
| `ArchiveBrowseLinks` | `browse` | Chip row | `onPeriodClick(ref)`, `onCustom()`, `onTimeline()` |
| `ArchiveEmptyState` | `empty` | Conditional quiet copy per section | — |

### Layout D wiring (ArchiveHomeView)

```
ArchiveFrame
ArchiveMarkCalendar          ← largest visual mass
ArchiveYouAreHere            ← compact; may merge with browse on mobile
ArchiveRecentMilestones
ArchiveAreaPills
ArchiveBrowseLinks
ArchiveEmptyState            ← overlays section empties, not a hero block
```

**Wide screen (K-30.7):** CSS grid — calendar ~60% left; milestones + areas + browse stacked ~40% right. Calendar remains in first viewport.

**Mobile:** Stack per K-30.7; horizontal scroll on calendar years and area pills.

### Branch views (post-Home phases — not K-30.9 scope, but inform shell)

| Branch | Component strategy | Reuse |
| ------ | ------------------ | ----- |
| Period | `ArchivePeriodView` wrapping adapted `RangeTraceLensView` | Projection: `buildRangeLensProjection`; add domain mark sections |
| Area | `ArchiveAreaView` wrapping adapted `AreaTraceView` | `buildAreaTraceProjection` + period filter |
| Timeline | `ArchiveTimelineView` (new) | Chronological merge of marks in scope — new projection in K-30.20+ |

### Shared primitives to extract (from Analytics + Note)

| Primitive | Source | Used by |
| --------- | ------ | ------- |
| Mark cell renderer | Analytics heatmap cells | `ArchiveMarkCalendar` |
| Section card wrapper | Analytics `theme.card` pattern | All Home sections |
| Trace section header | `RangeTraceLensView` → `TraceSection` | Period branch (extract to shared if needed) |
| Period chip / pill button | Note sidebar lens buttons (visual reference) | `ArchiveBrowseLinks`, `ArchiveAreaPills` |

---

## Projection Plan

Full contract defined in [K-30.8](./Knowledge-30.8-archive-home-projection-model.md). This section maps **what exists**, **what is new**, and **purity boundaries**.

### What already exists

| Capability | Existing code | Archive Home usage |
| ---------- | ------------- | ------------------ |
| Milestone detection | `milestoneNotes.ts` | `buildArchiveRecentMilestones` |
| Event detection | `eventNotes.ts` | Mark calendar note scan |
| Activity date rules | `resolveActivityKind` in `buildDailyTraceProjection.ts` | Mark calendar note scan |
| Area listing + membership | `listAreaNotes`, `resolveAreaMembership` | `buildArchiveAreaPills` |
| Calendar time helpers | `currentTraceMonth/Quarter/Year`, `toDateKey`, `enumerateDateKeys` | `buildArchiveYouAreHere`, browse links |
| Range lens model | `TraceRangeLens`, `ArchivePeriodRef` (to be added) | Navigation bridging |
| Domain mark row shape | `HeatmapDay` in AnalyticsView | `ArchiveDomainMarkDay` — same fields |
| Mark density (domain only) | `getMarkLevel()` | `domainMarkDayToTypes` + density — extend for note types |

### New builders required (P0 → P2)

| Priority | Builder | New logic |
| -------- | ------- | --------- |
| **P0** | `buildArchiveHomeProjection` | Orchestrator |
| **P0** | `buildArchiveMarkCalendarProjection` | Single-pass note mark index + domain merge |
| **P0** | `buildNoteMarkIndex` (internal) | Scan all notes once for milestone/event/activity dates in range |
| **P0** | `domainMarkDayToTypes` | Extract from Analytics `getMarkLevel` semantics |
| **P0** | `buildArchiveRecentMilestones` | Sort, cap, attach `periodRef` |
| **P0** | `buildArchiveYouAreHere` | Pure calendar from `now` |
| **P1** | `buildArchiveAreaPills` | 24-month lookback mark counting per area |
| **P1** | `buildArchiveBrowseLinks` | Derived period refs + static links |
| **P1** | `archivePeriodRefToTraceRangeLens` | Deep link bridge |
| **P2** | `weeks` grid precompute in projection | Optional UI convenience |
| **P2** | Milestone → area backlink resolution | Optional chips on milestone rows |
| **P2** | `recentYearsWithMarks` in browse | Derived from calendar |

### Proposed module layout (from K-30.8)

```
frontend/src/components/views/features/knowledge/archive/
├── archiveHomeModels.ts
├── buildArchiveYouAreHere.ts
├── buildArchiveMarkCalendar.ts
├── buildNoteMarkIndex.ts              # internal — not exported
├── buildArchiveRecentMilestones.ts
├── buildArchiveAreaPills.ts
├── buildArchiveBrowseLinks.ts
├── buildArchiveHomeProjection.ts
├── archivePeriodRefBridge.ts          # archivePeriodRefToTraceRangeLens
├── archiveHomeProjection.test.ts
└── index.ts
```

**Note:** Place projections under `knowledge/archive/` (data layer) separate from `features/archive/` (UI layer) — mirrors `trace/` vs trace view components.

### Pure vs UI-dependent

| Inside projection (pure) | Outside projection (UI / hooks) |
| ------------------------ | ------------------------------- |
| Merge note + domain marks | Fetch `domainMarks` via SWR |
| Sort, cap, filter, density | Tab routing, click handlers |
| Date math from `now` | i18n copy strings for frame subtitle |
| `empty.*` flags | Empty state prose (can read flags) |
| `labels.combined` in youAreHere | Locale passed via `options.locale` — formatting only, no React |

**Rule:** Projection returns **data and navigation refs** (`ArchivePeriodRef`, `ArchiveAreaRef`). Components resolve refs to shell navigation actions.

### Hook layer

```typescript
// features/archive/hooks/useArchiveHomeProjection.ts
function useArchiveHomeProjection(notes: NoteBase[], now: Date) {
  const bounds = archiveCalendarBounds(now, 5);
  const { data: domainMarks, isLoading } = useArchiveDomainMarks(bounds);
  return useMemo(
    () => buildArchiveHomeProjection({
      notes,
      now,
      domainMarks: domainMarks ?? [],
    }),
    [notes, now, domainMarks],
  );
}
```

**New Analytics dependency:** `useNotesStore(s => s.notes)` — Archive must read the vault; `AnalyticsProps` does not need to change if the hook reads the store directly.

### Test strategy (mirror trace tests)

| Test file | Cases |
| --------- | ----- |
| `archiveHomeProjection.test.ts` | Empty vault; milestone sort/limit; mark merge; density not weighted by routine %; area pill 24mo window; youAreHere quarter |
| Reuse fixtures from | `dailyTrace.test.ts`, `milestoneNotes.test.ts`, `areaTrace.test.ts` |

---

## Routing Strategy

### Current state

```
AppContent.tsx
  activeTab === 'analytics' → <AnalyticsView {...globalProps} />
Sidebar.tsx
  tab id: 'analytics', icon: BarChart2, label: t('analytics')
```

No URL routing — tab state only. Archive IA (`archiveView: home | period | area | timeline`) is **internal state** initially.

### Option analysis: Evolve AnalyticsView vs new ArchiveView

| Criterion | Evolve `AnalyticsView` | New `ArchiveView.tsx` |
| --------- | -------------------- | --------------------- |
| Risk | Lower — incremental; old widgets removed section by section | Higher — big-bang swap in `AppContent` |
| Git history | Continuous file | Clean break but loses blame context |
| Parallel work | Can land projection + shell behind feature flag in same file | Requires duplicate mount or branch |
| Testing | Section-by-section visual diff | Full page replace harder to review |
| Tab rename | Natural final step inside same file rename | Requires import swap + rename together |
| Monolith risk | Must discipline extractions | Fresh start avoids 720-line debt |

**Recommendation: Evolve in place**

1. Create `features/archive/` module tree.
2. `AnalyticsView` imports `ArchiveShell` when ready; initially coexists with legacy widgets.
3. Remove legacy widgets phase by phase (K-30.16–K-30.17).
4. Optionally rename file `AnalyticsView.tsx` → `ArchiveView.tsx` **only at tab rename** (K-30.21) to avoid churn.

### Internal navigation model

```typescript
type ArchiveView = 'home' | 'period' | 'area' | 'timeline';

interface ArchiveNavigationState {
  view: ArchiveView;
  periodScope?: ArchivePeriodRef;
  areaId?: string;
  timelineDate?: string;
}
```

**State location:** `ArchiveShell` via `useState` — not URL, not global store (K-30.8 defers persist last scope).

**Back stack:** Period / Area / Timeline → Home. Breadcrumb: `Archive` › `2026 Q2` › …

### Deep links (deferred K-30.22+)

Document only — do not implement in first phases:

```
?tab=analytics&archive=home
?tab=analytics&archive=period&year=2026&quarter=2
```

### AnalyticsView evolution tradeoffs

| Approach | Pros | Cons |
| -------- | ---- | ---- |
| **Big-bang replace** (Home only, delete all widgets) | Clean UX immediately | High regression risk; no fallback |
| **Incremental (recommended)** | Safe; reviewable PRs; projection validated before UI | Temporary dual UI during migration |
| **Feature flag** | Instant rollback | Flag debt; probably unnecessary for single-user product |

---

## Migration Strategy

### Philosophy alignment checkpoints

Every PR must pass:

1. **No new scores, streaks, or evaluative copy**
2. **Home renders projection only** — no inline aggregation after K-30.12
3. **Operational widgets exit the tab** — not hidden, removed (Planner / Health own them)
4. **Note remains capture** — Archive links out, never edits

### Analytics → Archive transformation map

| Current Analytics surface | Migration action | Destination |
| ------------------------- | ---------------- | ----------- |
| Tab label "Analytics" | **Defer** rename to K-30.21 | Sidebar → "Archive" |
| "Period Overview" header | Replace on Home with Archive frame | Archive Home |
| Time range picker | Move to Period branch | `ArchivePeriodView` |
| Activity This Week | Remove from tab | Period summary (optional, later) |
| Scheduled Time by Category | Remove from tab | Planner |
| Exception Days | Move to Period § Transitions | `ArchivePeriodView` |
| Activity Calendar (16 weeks) | Extract → multi-year Mark Calendar | Archive Home |
| Workout Records grid | Remove from tab | Health; Period body summary later |
| Today's Routine Marks | Remove from tab | Planner |
| Today's Schedule | Remove from tab | Planner |
| Weekly Timetable | Remove from tab | Planner (may already exist partially) |

### Data migration

**None required.** Archive reads existing note properties and API aggregates. Backend change is **API extension** (parameterized date range), not schema migration.

### User-visible migration narrative

| Stage | User sees |
| ----- | --------- |
| K-30.10 | No change |
| K-30.11–K-30.15 | No change (or dev-only preview) |
| K-30.16 | Opens Analytics tab → Archive Home (sidebar still says Analytics) |
| K-30.17 | Operational clutter gone from tab |
| K-30.18–K-30.20 | Period / Area / Timeline depth available |
| K-30.21 | Sidebar says Archive |

---

## Phased Implementation Plan

### K-30.10 — Projection layer + backend marks API

**Goal:** Ship `buildArchiveHomeProjection` contract with tests. Zero UI change.

| Task | Detail |
| ---- | ------ |
| Create `knowledge/archive/` module | All types + builders per K-30.8 |
| Implement `buildNoteMarkIndex` | Single-pass O(notes) scan |
| Extract `domainMarkDayToTypes` | From Analytics `getMarkLevel` semantics |
| Backend | Extend `get_heatmap` with `start_date` / `end_date` query params (or alias `/api/archive_marks`) |
| Tests | Full coverage per K-30.8 test table |
| Export | Add to `knowledge/index.ts` or `trace/index.ts` re-export |

**Exit criteria:** `buildArchiveHomeProjection` passes tests; API returns 5-year range; AnalyticsView untouched.

---

### K-30.11 — Archive shell + hook (no visible default switch)

**Goal:** Navigation container exists; not yet default landing.

| Task | Detail |
| ---- | ------ |
| `archiveNavigationModels.ts` | Internal view enum + state |
| `useArchiveDomainMarks` + `useArchiveHomeProjection` | SWR + useMemo |
| `ArchiveShell.tsx` | Renders Home or branch placeholder |
| Wire `useNotesStore` | Notes into projection hook |
| Dev entry | Optional `?archive=1` query or comment-gated render for manual QA |

**Exit criteria:** Shell renders Home from projection in dev; Analytics widgets still default.

---

### K-30.12 — Mark calendar component

**Goal:** First visible Home section; largest visual piece.

| Task | Detail |
| ---- | ------ |
| Extract grid algorithm from AnalyticsView | Into `ArchiveMarkCalendar.tsx` |
| Feed from `markCalendar` projection | Multi-year span (default 5 years) |
| Merge note + domain mark types in tooltip | Type-tagged, not score |
| Legend | "Fewer marks … More marks" (keep K-30.3 language) |
| Click handlers | Emit navigation refs (stub until Period/Timeline exist) |

**Exit criteria:** Calendar renders correctly from projection; Analytics inline heatmap still present until K-30.16.

---

### K-30.13 — Recent milestones

**Goal:** Meaning block below calendar.

| Task | Detail |
| ---- | ------ |
| `ArchiveRecentMilestones.tsx` | 3–5 rows, no padding with fakes |
| Empty | Hide section or show quiet line via `empty.noMilestones` |
| Click | Navigate to Period scope (stub OK) |

---

### K-30.14 — Area pills

**Goal:** Concern entry points.

| Task | Detail |
| ---- | ------ |
| `ArchiveAreaPills.tsx` | Horizontal scroll; max 8 |
| Sort | By `lastMarkDate` from projection — **do not display markCount** |
| "All areas →" | Navigate to Area index stub |

---

### K-30.15 — Frame, YouAreHere, Browse, Empty

**Goal:** Complete Home layout D.

| Task | Detail |
| ---- | ------ |
| `ArchiveFrame` | "Archive" + "What remains when you look back." |
| `ArchiveYouAreHere` | Compact line + open period |
| `ArchiveBrowseLinks` | Period chips + All areas |
| `ArchiveEmptyState` | Sparse vault copy |
| `ArchiveHomeView` | Compose all sections; responsive grid |

**Exit criteria:** Full Home matches K-30.7 wireframe from projection data.

---

### K-30.16 — Archive Home becomes default

**Goal:** User opens Analytics tab → sees Archive Home.

| Task | Detail |
| ---- | ------ |
| `AnalyticsView` → render `ArchiveShell` with `view: 'home'` as default | |
| Hide legacy Analytics widgets | Remove from render tree (not delete files yet if risky) |
| Keep sidebar label "Analytics" | Per constraint |

**Exit criteria:** Tab opens to Archive Home; no Period Overview header on landing.

---

### K-30.17 — Remove operational widgets from tab

**Goal:** Clean tab — no Planner/Health leakage.

| Task | Detail |
| ---- | ------ |
| Delete Weekly Timetable block + modal from AnalyticsView | Move to Planner in separate PR if not already there |
| Delete workout grid, routine marks, today schedule | |
| Delete Activity This Week + Scheduled Time by Category | |
| Remove unused SWR calls from tab | Keep domain marks fetch only |

---

### K-30.18 — Period branch

**Goal:** Browse / YouAreHere / calendar clicks land in Period view.

| Task | Detail |
| ---- | ------ |
| `ArchivePeriodView` | Wrap `RangeTraceLensView` with Archive chrome |
| Extend projection | Domain marks + exception days in period synthesis |
| Adapt period picker | From Analytics time range → Note-aligned lenses |
| Back navigation | → Home |

---

### K-30.19 — Area branch

**Goal:** Area pills and "All areas" work.

| Task | Detail |
| ---- | ------ |
| `ArchiveAreaView` | Wrap `AreaTraceView` |
| Area index list | Areas with any marks |
| Optional period filter | Area × time |

---

### K-30.20 — Timeline branch

**Goal:** Calendar day click → chronological feed.

| Task | Detail |
| ---- | ------ |
| New `buildArchiveTimelineProjection` | Merge marks in scope — **new work beyond K-30.8 Home** |
| `ArchiveTimelineView` | Read-only feed linking to sources |

---

### K-30.21 — Tab rename Analytics → Archive

**Goal:** Product identity matches architecture.

| Task | Detail |
| ---- | ------ |
| `TabId` | `'analytics'` → `'archive'` (or keep id, change label only — team choice) |
| `Sidebar.tsx` | Icon BarChart2 → Archive (Layers / Archive box) |
| `i18n.ts` | `analytics` → `archive` keys |
| Optional | Rename `AnalyticsView.tsx` → `ArchiveView.tsx` |
| `AnalyticsProps` | → `ArchiveProps` |

**Note:** K-30.9 constraint deferred this; plan it last to avoid renaming twice.

---

## Risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| **720-line Analytics monolith** | High | Strict extraction PRs; no new inline logic in AnalyticsView after K-30.11 |
| **No notes in AnalyticsProps today** | Medium | Hook reads `useNotesStore` directly; do not thread notes through AppContent |
| **Heatmap API 112-day cap** | High | K-30.10 backend PR blocks calendar; front-load API work |
| **5-year note scan performance** | Medium | Single-pass index; memoize on notes reference; profile with large fixtures |
| **Duplicate UX with Note lenses** | Medium | Archive Home is cross-domain + multi-year; Note stays edit-forward single-period |
| **Premature tab rename** | Low | Rename last; in-view copy can say Archive before sidebar does |
| **Widget removal breaks user habit** | Medium | Timetable/workout grid move to Planner/Health **before or same release** as removal |
| **Projection / UI drift** | Medium | Home components accept only projection types; ESLint rule or code review checklist |
| **i18n debt** | Low | Frame strings hardcoded initially; i18n pass with K-30.21 rename |
| **Incomplete navigation stubs** | Low | Ship Home first with inert clicks OK briefly; complete in K-30.18 |

---

## Recommended First PR

### K-30.10 — Projection layer only

**Why this PR first:**

1. **Zero user-visible risk** — no UI, no routes, no rename
2. **Validates K-30.8 contract** before any component exists
3. **Unblocks parallel work** — UI and backend can proceed from frozen types
4. **Testable in isolation** — mirrors successful K-28 trace rollout pattern
5. **Extracts `getMarkLevel` semantics** into shared pure code before calendar extraction

**PR scope:**

```
backend/main.py                          # Parameterized heatmap date range
frontend/src/.../knowledge/archive/      # All projection modules
frontend/src/.../archive/archiveHomeProjection.test.ts
frontend/docs/Knowledge-30.9-...md       # This document
```

**PR must not include:**

- Changes to `AnalyticsView.tsx` render output
- Sidebar or `AppContent` changes
- New React components
- Tab rename

**PR acceptance checklist:**

- [ ] `buildArchiveHomeProjection` returns all K-30.8 fields
- [ ] Empty vault → `empty.isEmpty === true`, no synthetic marks
- [ ] Milestone limit defaults to 5, newest first
- [ ] Mark density = distinct types, exception excluded from count
- [ ] Area pills exclude areas with zero marks in 24-month window
- [ ] API returns ≥ 5 years of domain marks when requested
- [ ] No scores, streaks, or `%` fields in projection types

---

## Appendix — Safest Incremental Path (Summary)

**Question:** If implementation starts tomorrow, what is the safest and most incremental path from Analytics to Archive?

**Answer:**

1. **Build the read model first** (K-30.10) — pure projections + extended API, no UI.
2. **Add shell and hooks without switching the default tab** (K-30.11) — prove notes + domain marks merge.
3. **Ship Home sections one at a time** (K-30.12–K-30.15) — calendar → milestones → areas → wayfinding.
4. **Flip the default landing** (K-30.16) — Archive Home replaces Period Overview; sidebar still says Analytics.
5. **Remove operational widgets** (K-30.17) — after Planner/Health absorb them.
6. **Add depth branches** (K-30.18–K-30.20) — reuse `RangeTraceLensView` / `AreaTraceView`.
7. **Rename the tab last** (K-30.21) — identity change when architecture is stable.

This sequence minimizes risk, maximizes reuse of K-28/K-29 trace code, preserves K-30.3 evidence-first language, and avoids a big-bang rewrite of the Analytics monolith.

---

## Relationship to Prior Milestones

| Milestone | K-30.9 relationship |
| --------- | --------------------- |
| K-30.8 | Projection contract — implementation order derived from here |
| K-30.7 | Layout D → component plan |
| K-30.6 | Hybrid IA → shell branches + migration map |
| K-30.5 | Archive identity → constraints on every phase |
| K-30.3 | Asset audit classifications; mark density semantics |
| K-30.2 | Original Analytics inventory — updated with post-K-30.3 state |
| K-28 / K-29 | Reuse map for projections and branch views |

---

*K-30.9 — implementation roadmap only. Projection first, Home second, rename last.*
