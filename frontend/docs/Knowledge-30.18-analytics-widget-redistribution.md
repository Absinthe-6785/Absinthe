# Knowledge-30.18 — Analytics Widget Redistribution

## Scope

Ownership cleanup only. **No tab rename, no UI redesign, no Calendar implementation, no Event/D-Day model changes.**

Builds on K-30.16 (Archive Home default landing) and K-30.17 (Planner / Event / Calendar direction).

**Current runtime:** `ARCHIVE_SHELL_ENABLED = true` — users see Archive Home on the Analytics tab. Legacy Analytics body (~650 lines in `AnalyticsView.tsx`) remains in code but is **skipped at render**. Hooks and SWR fetches for legacy widgets **still execute** before the early return.

**Goal:** Every remaining legacy Analytics artifact has a declared owner — **Archive**, **Planner**, **Health**, or **Remove** — with a safe migration path.

---

## Executive Summary

Legacy Analytics is a **holding area**, not a destination. Archive Home already owns historical orientation. Operational widgets must return to **Planner** (execution) or **Health** (body logging), or be **removed** as duplicates.

| Destination | Count | Examples |
| ----------- | ----- | -------- |
| **Archive** | 3 (+ Period branch later) | Mark calendar (done), exception-day context, period scope chrome |
| **Planner** | 4 | Weekly Timetable, Today's Schedule, Today's Routine Marks, Scheduled Time by Category (optional) |
| **Health** | 1 | Workout week grid |
| **Remove** | 3 | Activity This Week, legacy 16-week heatmap, Analytics page wrapper |

**First safe implementation PR (K-30.19):** Move **Weekly Timetable** (+ CRUD modal) to Planner — highest user value, zero overlap with existing Planner UI, data already available via `useStaticData`.

---

## Remaining Analytics Inventory

Source: `frontend/src/components/views/AnalyticsView.tsx` (lines approximate, legacy path only).

### Page chrome

| # | Section | Lines | Data / hooks | User-visible today? |
| - | ------- | ----- | ------------ | ------------------- |
| 1 | **Period Overview header** | 281–284 | `analyticsStart`, `analyticsEnd` from `timeRange` state | No (Archive shown) |
| 2 | **Time range picker** (Today · Weekly · Monthly · Custom) | 286–310 | `timeRange`, `customStartDate/End` | No |

### Left column widgets

| # | Section | Lines | Data / hooks | User-visible today? |
| - | ------- | ----- | ------------ | ------------------- |
| 3 | **Activity This Week** | 318–372 | `weeklyReview` ← `heatmapData`, `computedStats` | No |
| 4 | **Scheduled Time by Category** | 375–400 | `computedStats` ← `GET /api/schedules/range` | No |
| 5 | **Exception Days** (collapsible list) | 402–426 | `routineExceptions` ← `GET /api/routine_exceptions` | No |
| 6 | **Activity Calendar** (16-week heatmap) | 428–503 | `heatmapData` ← `GET /api/heatmap`, inline grid | No |
| 7 | **Workout Records** (week toggle grid) | 505–545 | `weekWorkouts` ← `GET /api/workouts/range`, `workoutToggle` sessionStorage | No |
| 8 | **Today's Routine Marks** | 547–565 | `routines`, `routineExceptions`, `isExceptionDay` | No |
| 9 | **Today's Schedule** (daily range only) | 567–599 | `dailyStats` ← `analyticsSchedules` | No |

### Right column + modals

| # | Section | Lines | Data / hooks | User-visible today? |
| - | ------- | ----- | ------------ | ------------------- |
| 10 | **Weekly Timetable** (7-day hour grid + blocks) | 603–662 | `weeklySchedules` prop ← `GET /api/weekly_schedules` | No |
| 11 | **Weekly schedule CRUD modal** | 665–715 | `saveWeeklySchedule`, `deleteWeeklySchedule` | No |
| 12 | **ConfirmModal** (delete weekly block) | shared | `useConfirm` | No |

### Module-level helpers (legacy-only)

| Asset | Lines | Used by |
| ----- | ----- | ------- |
| `CATEGORY_META` | 14–21 | Scheduled Time by Category, Today's Schedule |
| `HeatmapDay`, `getMarkLevel`, `formatHeatmapTooltip` | 33–59 | Activity Calendar, weeklyReview |
| `parseTime`, `DAYS_OF_WEEK` | 24–31, 642+ | Weekly Timetable |
| `weeklyReview` useMemo | 252–271 | Activity This Week |

### Props / data wired through AppContent but unused in Archive path

| Prop / fetch | Passed to | Used when Archive enabled? |
| ------------ | --------- | -------------------------- |
| `weeklySchedules` | `AnalyticsView` only (not PlannerView) | No — fetched globally via `useStaticData` |
| `schedules`, `routines` | Analytics + Planner | Analytics hooks still run; Planner uses independently |
| SWR: `/api/heatmap`, `/api/schedules/range`, `/api/workouts/range`, `/api/routine_exceptions` | AnalyticsView hooks | **Yes — still fetched** (wasted when flag true) |

### Already replaced by Archive (K-30.12–K-30.16)

| Legacy widget | Archive replacement | Status |
| ------------- | ------------------- | ------ |
| Activity Calendar (16 weeks) | `ArchiveMarkCalendar` (5-year, note + domain marks) | Live on Archive Home |
| Period Overview identity | Archive frame ("Archive" / "What remains when you look back?") | Live |
| Implicit heatmap marks | `useArchiveDomainMarks` → same `/api/heatmap` backend | Live |

---

## Ownership Mapping

Classification rules (from migration rules):

- **Archive** — historical context, marks, milestones, events, areas, retrospective
- **Planner** — schedules, routines, upcoming commitments, execution surfaces
- **Health** — workout tracking, nutrition, body metrics
- **Remove** — duplicated summaries, obsolete wrappers, analytics-only aggregation

### Full widget table

| Widget | Current location | Destination | Reason | Migration risk |
| ------ | ---------------- | ----------- | ------ | -------------- |
| **Period Overview header** | AnalyticsView | **ARCHIVE** (Period branch) | Period scope chrome belongs in Archive depth navigation, not operational Analytics | Low — already conceptually replaced by Archive frame; implement in K-30.20+ Period branch |
| **Time range picker** | AnalyticsView | **ARCHIVE** (Period branch) | Align with Note lenses (Month / Quarter / Year / Custom) for retrospective scope | Low — reuse `ArchivePeriodRef` from projection layer |
| **Activity This Week** | AnalyticsView | **REMOVE** | Aggregated cross-domain summary; duplicates mark counts Archive will show in Period view without productivity framing | Low — no unique data; `weeklyReview` computed only here |
| **Scheduled Time by Category** | AnalyticsView | **PLANNER** (optional Period panel) or **REMOVE** | Forward planning context — hours by category for a selected range; not historical identity | Medium — if kept, belongs in Planner week review or future Calendar Week mode, not Archive Home |
| **Exception Days list** | AnalyticsView | **ARCHIVE** (Period context) + **PLANNER** (write path exists) | Retrospective: explains gaps in mark calendar. Operational: Planner Routines already show exception banner + modal | Low for read in Archive Period; Planner already owns CRUD via routine exception modal |
| **Activity Calendar (16-week heatmap)** | AnalyticsView | **REMOVE** | Superseded by `ArchiveMarkCalendar`; keeping both creates duplicate mark UX | Low — delete after confirming Archive calendar covers domain marks |
| **Workout Records week grid** | AnalyticsView | **HEALTH** | Body-session logging affordance; toggles display of workout days, not planning | Medium — Health has daily workout editor but no week-at-a-glance grid; move widget as-is |
| **Today's Routine Marks** | AnalyticsView | **PLANNER** | Duplicate — Planner Routines column already shows same-day checklist + exception state | Low — delete from Analytics; no move needed (already in Planner) |
| **Today's Schedule** | AnalyticsView | **PLANNER** | Duplicate — Planner Timeline shows selected-day schedule blocks | Low — delete from Analytics; no move needed |
| **Weekly Timetable** | AnalyticsView | **PLANNER** | Recurring weekly plan template — core forward-planning surface per K-30.17 | **Medium** — only surface for `weekly_schedules` CRUD today; must move before legacy deletion |
| **Weekly schedule CRUD modal** | AnalyticsView | **PLANNER** | Paired with Weekly Timetable | Medium — move with timetable |
| **CATEGORY_META** | AnalyticsView module | **PLANNER** (shared) | Schedule category icons/colors used by Timeline + timetable | Low — extract to shared module when moving schedule widgets |
| **Heatmap helpers** | AnalyticsView module | **REMOVE** | Only served legacy Activity Calendar + weeklyReview | Low — Archive has `archiveMarkCalendarPresentation.ts` |
| **Legacy SWR hooks** (heatmap, range schedules, week workouts, exceptions) | AnalyticsView | **REMOVE** (guard or delete) | Archive uses `useArchiveDomainMarks`; Planner/Health use own hooks | Medium — guard behind `!ARCHIVE_SHELL_ENABLED` first to stop wasted fetches |

---

## Recommended Redistribution

### Archive keeps (historical)

| Asset | Action |
| ----- | ------ |
| Archive Home (live) | No change |
| Mark Calendar projection | No change — replaces legacy heatmap |
| Exception days (read) | Surface in **Archive Period branch** as context, not Home |
| Period scope picker | Future Period branch — reuse browse period refs |
| Milestones, events, areas | Already Note → Archive projection |

### Planner receives (execution)

| Asset | Priority | Notes |
| ----- | -------- | ----- |
| **Weekly Timetable + modal** | **P0 — move first** | Not present in PlannerView today; `weeklySchedules` already in `useStaticData` but only passed to AnalyticsView |
| Today's Schedule panel | **P1 — delete from Analytics only** | Already covered by Planner Timeline |
| Today's Routine Marks panel | **P1 — delete from Analytics only** | Already covered by Planner Routines |
| Scheduled Time by Category | **P2 — optional** | Defer or add as read-only Week summary in Planner; do not put on Archive Home |

### Health receives (body)

| Asset | Priority | Notes |
| ----- | -------- | ----- |
| **Workout Records week grid** | **P1** | Week toggle UI; complements daily workout session in HealthView; uses `/api/workouts/range` |

### Remove (no new owner)

| Asset | Reason |
| ----- | ------ |
| Activity This Week | Obsolete aggregation; Archive Period can show factual mark counts without "Activity This Week" framing |
| Activity Calendar (16-week) | Replaced by Archive Mark Calendar |
| Period Overview + range chrome (legacy copy) | Replaced by Archive shell; Period branch gets new chrome |
| Analytics-only wrappers | Left/right column layout tied to retired identity |

---

## Migration Risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| **Weekly Timetable unreachable** after legacy delete | **High** | Move to Planner before removing Analytics legacy body |
| **Rollback to legacy Analytics** (`ARCHIVE_SHELL_ENABLED=false`) | Medium | Keep extracted `LegacyAnalyticsView.tsx` until redistribution complete; or document rollback window |
| **Duplicate UX** (Planner + Analytics both showing routines/schedule) | Low | Delete Analytics duplicates first; they are already hidden |
| **Wasted API calls** while legacy hooks run | Medium | Phase 0: guard SWR behind `!ARCHIVE_SHELL_ENABLED`; Phase N: delete hooks |
| **Workout grid sessionStorage** (`workoutToggle`) | Low | Move key namespace with widget to Health |
| **Scheduled Time by Category** — nowhere to land if deferred | Low | Default to **Remove** unless Planner Week mode needs it (K-30.20+) |
| **Exception Days** — two surfaces | Low | Planner: write + today banner; Archive Period: read-only list for past context |
| **Type drift** (`end_next_day`, `is_exception_day`) | Low | Fix types when extracting shared schedule modules |
| **User habit** — users who disabled Archive flag | Low | Redistribution doc + release note; flag rollback temporary |

---

## Phased Removal Plan

Aligned with K-30.17 migration path. **K-30.18 = this document (ownership locked).** Implementation in subsequent PRs.

### Phase 0 — K-30.18 (this milestone)

- [x] Inventory all legacy Analytics sections
- [x] Assign owner per widget
- [x] Document risks and phased plan
- **No code changes required for success criteria**

### Phase 1 — K-30.19: Stop the bleed

| Task | Owner |
| ---- | ----- |
| Guard legacy SWR fetches behind `!ARCHIVE_SHELL_ENABLED` | AnalyticsView |
| Extract legacy body to `LegacyAnalyticsView.tsx` (optional, rollback safety) | AnalyticsView |
| Add redistribution comment map at top of legacy file | Docs in code |

**Exit:** Archive enabled → zero legacy network calls.

### Phase 2 — K-30.20: Planner absorbs timetable

| Task | Owner |
| ---- | ----- |
| Move Weekly Timetable grid + CRUD modal to PlannerView (append section, no redesign) | Planner |
| Pass `weeklySchedules` + `mutateStatic` already on global props | AppContent (verify PlannerProps) |
| Move `parseTime`, weekly modal handlers with widget | Planner or `features/planner/` extract |
| Tests: weekly schedule CRUD from Planner tab | Vitest |

**Exit:** Users manage recurring weekly blocks from Planner; legacy copy still exists if flag false.

### Phase 3 — K-30.21: Health absorbs workout week grid

| Task | Owner |
| ---- | ----- |
| Move Workout Records week toggle grid to HealthView | Health |
| Preserve `/api/workouts/range` fetch in Health hook or local SWR | Health |
| Migrate `workoutToggle` sessionStorage key or namespace | Health |

**Exit:** Workout week glance lives in Health.

### Phase 4 — K-30.22: Delete Analytics duplicates

| Task | Action |
| ---- | ------ |
| Today's Routine Marks | **Delete** from legacy Analytics |
| Today's Schedule | **Delete** from legacy Analytics |
| Activity This Week | **Delete** |
| Activity Calendar (16-week) | **Delete** |
| Scheduled Time by Category | **Delete** or move to Planner if Phase 2 deferred optional panel |

**Exit:** Legacy Analytics body ≤ Weekly Timetable + Exception list + Period chrome (or empty if flag stays true).

### Phase 5 — K-30.23: Thin Analytics to Archive-only

| Task | Action |
| ---- | ------ |
| Remove legacy render path when confident in rollback | Delete `LegacyAnalyticsView` or keep behind flag |
| Remove `AnalyticsProps` fields only Analytics used | `weeklySchedules` → PlannerProps only |
| Remove module helpers: `getMarkLevel`, `formatHeatmapTooltip`, inline heatmap grid | Delete |
| `AnalyticsView.tsx` → Archive shell + hooks only (~30 lines) | Target end state |

**Exit:** Analytics tab = Archive only; no operational widgets in file.

### Phase 6 — Archive Period branch (parallel track K-30.20+)

| Widget | Action |
| ------ | ------ |
| Period Overview chrome | Reimplement in Archive Period branch |
| Time range picker | Reuse `ArchivePeriodRef` / Note lens vocabulary |
| Exception Days (read) | Period context panel |
| Scheduled hours context | Optional Period summary — factual, not ranked |

---

## Follow-ups

| Item | Milestone | Notes |
| ---- | --------- | ----- |
| Weekly Timetable → Planner | K-30.20 | P0 implementation |
| Workout week grid → Health | K-30.21 | P1 implementation |
| Guard legacy SWR | K-30.19 | Quick win |
| Planner Calendar landing | K-30.20+ | Out of scope for redistribution |
| D-Day → Events merge | K-30.22+ | Out of scope |
| Locale on Archive browse labels | K-30.23+ | Separate from widget ownership |
| Analytics tab rename → Archive | K-30.21+ | After tab is Archive-only |
| `database.types.ts` schedule fields | Maintenance | Add `is_dday`, `category`, `end_next_day` |
| Backend `/api/heatmap` route audit | Maintenance | Ensure endpoint registered if Archive depends on it |

---

## Decision Record

| Question | Answer |
| -------- | ------ |
| Where does Weekly Timetable go? | **Planner** |
| Where does Workout week grid go? | **Health** |
| Where do Today's Schedule / Routine panels go? | **Planner** (already there — **remove** from Analytics) |
| Where does legacy heatmap go? | **Remove** — Archive Mark Calendar owns this |
| Where does Activity This Week go? | **Remove** |
| Where does Exception Days list go? | **Archive Period** (read) + **Planner** (write, exists) |
| Where does Scheduled Time by Category go? | **Planner** (optional) or **Remove** |
| When is Analytics "thin enough"? | When `AnalyticsView.tsx` renders only `ArchiveShell` and legacy file is deleted |

---

## Success Criteria Checklist

After redistribution implementation (Phases 1–5):

- [ ] Every legacy widget has owner: Archive, Planner, Health, or Removed
- [ ] Weekly Timetable accessible from Planner
- [ ] Workout week grid accessible from Health
- [ ] No duplicate Today panels in Analytics
- [ ] No legacy 16-week heatmap in Analytics
- [ ] Archive enabled → no legacy Analytics network calls
- [ ] Analytics tab progressively thinner until Archive-only

**K-30.18 complete when this document is approved** — ownership is unambiguous before code moves begin.

---

## Relationship to Prior Milestones

| Milestone | Relationship |
| --------- | -------------- |
| K-30.9 | Original widget classification — this doc updates post-K-30.16 state |
| K-30.16 | Archive Home live; legacy hidden not deleted |
| K-30.17 | Planner direction — timetable move confirms P0 |
| K-30.5 | Archive vs Planner domain rules — redistribution enforces boundaries |

---

*K-30.18 — ownership and redistribution plan only. Implementation begins at K-30.19 (hook guard) and K-30.20 (Weekly Timetable → Planner).*
