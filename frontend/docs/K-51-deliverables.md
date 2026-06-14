# K-51 Daily Workflow Integration — Deliverables

Branch: `k51-daily-workflow-integration`

## 1. Architecture Summary

### Countdown unification (Priority 1)

Legacy D-Day (`schedules.is_dday=true`) is removed from the read path. Countdowns now come exclusively from **note-backed event notes** via `buildPlannerCountdowns(eventDefinitions, now)`.

**One-time migration** (`migrateLegacyDdays.ts`):
- Runs on app boot after `hydrateFromDB()`
- Fetches `/api/schedules/ddays`
- Creates event notes via `applyEventToNote` (deduped by date+title)
- Deletes legacy schedule rows
- Sets `localStorage` flag `absinthe:dday-migration-v1`

**Removed:**
- D-Day CRUD modal and schedule `is_dday` checkbox
- `legacyDdays` prop chain (useStatic → AppContent → PlannerView → CalendarShell)
- Month grid legacy D-Day badges
- Dual-source projection merge

**Added:**
- `ScheduleCountdownPanel` creates event notes via "Add" button
- All countdown rows link to source notes

### Actionable Day dashboard (Priority 2)

`DayRoutineSummary` / `DayTodoSummary` now support:
- Inline add (Enter to submit)
- Toggle complete with keyboard
- Double-click inline edit
- Progress bars (done/total %)

Wired from `PlannerView` via `onAdd`, `onEdit`, `onToggle`.

`DayCountdownStrip` deadlines:
- Open source note (click row)
- Mark reviewed (dismisses via `countdownReviewed.ts` localStorage)

### Health dashboard maturation (Priority 3)

`HealthDashboardPanel` expanded:
- Weekly workout session count (`/api/workouts/range`)
- Weekly protein average (7-day intake fetch)
- Last exercise name (today's log)
- Week-over-week PR detection from range data
- Habit setup summary (blocks + routines)
- Existing: protein progress, set completion, InBody snapshot

### Knowledge dashboard consistency (Priority 4)

- New `DashboardCardHeader` component (Lucide 14px, strokeWidth 2.25)
- Applied to Timeline, Discovery, Activity, and Evolution cards

### Scientific notes QA (Priority 5)

Extended `mathRendering.test.ts` for:
- Quadratic formula display math
- `\begin{align}` environment
- `\begin{pmatrix}` matrix environment

---

## 2. Migration Strategy

| Phase | Action | Status |
|-------|--------|--------|
| A | One-time `migrateLegacyDdays()` on boot | Implemented |
| B | Stop legacy writes (remove CRUD UI) | Implemented |
| C | Remove dual-read projection | Implemented |
| D | Backend `GET /api/schedules/ddays` | Retained for migration fetch only; returns empty after migration |

Migration is **idempotent** and **preserves user data** by converting rows to event notes before deletion.

---

## 3. UX Findings

| Area | Before | After |
|------|--------|-------|
| D-Day | Dual storage, legacy CRUD | Note-only countdowns |
| Day routines/tasks | Toggle only | Add, edit, progress bar |
| Day deadlines | View only | Open note + mark reviewed |
| Health dashboard | Daily snapshot only | Weekly volume, protein avg, PRs |
| Knowledge cards | Text-only headers | Lucide headers (all 4 dashboard cards) |
| Month view | Legacy amber D-Day chips | Event notes only (cleaner) |

---

## 4. Files Created

| File | Purpose |
|------|---------|
| `lib/migrateLegacyDdays.ts` | One-time D-Day → event note migration |
| `lib/migrateLegacyDdays.test.ts` | Migration unit tests |
| `knowledge/components/DashboardCardHeader.tsx` | Shared dashboard card header |
| `lib/countdownReviewed.ts` | localStorage reviewed-state for deadline cards |
| `docs/K-51-deliverables.md` | This document |

---

## 5. Files Modified

| File | Changes |
|------|---------|
| `buildPlannerCalendarProjection.ts` | Note-only countdowns |
| `calendarModels.ts` | Remove `legacyDdays` input, `legacy-dday` source |
| `usePlannerCalendarProjection.ts` | Remove legacy prop |
| `CalendarShell.tsx` | Remove legacy prop |
| `PlannerView.tsx` | Remove D-Day CRUD; add countdown note creation; wire day actions |
| `ScheduleCountdownPanel.tsx` | Note-only panel |
| `DayRoutineSummary.tsx` / `DayTodoSummary.tsx` | Actionable dashboard |
| `dayRoutineActions.ts` / `dayTodoActions.ts` | Add `onAdd` |
| `DayCountdownStrip.tsx` | All rows note-backed |
| `month/*` | Remove legacy badge layer |
| `useStatic.ts` / `AppContent.tsx` / `types/index.ts` | Remove `ddays` |
| `HealthDashboardPanel.tsx` | Weekly metrics |
| `TimelineDashboardCard.tsx` / `DiscoveryDashboardCard.tsx` | Lucide headers |
| `mathRendering.test.ts` | Advanced math QA |
| `i18n.ts` | K-51 strings |
| Test files | Updated for note-only countdowns |

---

## 6. Verification Results

```bash
npm run typecheck   # PASS
npm run build       # PASS
npm run test        # PASS — 1877 tests (258 files)
```

---

## 7. Recommended K-52 Roadmap

1. **Shared protein SWR hook** — eliminate duplicate fetches in HealthDashboardPanel and ProteinTracker
2. **Habit daily tracking** — completion check-offs tied to health routine splits
3. **Knowledge card polish** — apply `DashboardCardHeader` to Activity and Evolution cards; unified empty states
4. **Context panel** — empty states for graph/insights/actions tabs
5. **Schedule** — reviewed-countdown dismiss state; month countdown dots for event target dates
6. **Math** — copy/paste LaTeX audit; export path validation
