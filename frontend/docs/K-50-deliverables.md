# K-50 Workspace Consolidation — Deliverables

Branch: `k50-workspace-consolidation`

## 1. Architecture Summary

### Schedule (Priority 1)

**Day view → daily dashboard.** `DayCalendarView` now uses a two-column grid:

| Left column | Right column |
|-------------|--------------|
| Schedule blocks + carry-over | Upcoming deadlines (`DayCountdownStrip`) |
| Note-backed events | Interactive routines (`DayRoutineSummary`) |
| Weekly template hints | Interactive tasks (`DayTodoSummary`) |
| Today's activity feed (`DayActivitySection`) | |

Routine/task toggles are wired from `PlannerView` via `dayRoutineActions` / `dayTodoActions` through `CalendarShell`.

**Agenda → forward-looking lens.** Removed `AgendaScheduleList` and `AgendaTodoList` (duplicated Day view). Agenda now shows:

- Countdowns / deadlines (note-backed rows link to notes)
- Chronological events + milestones
- Routine exception dates within the horizon

**D-Day convergence.** `ScheduleCountdownPanel` replaces the legacy D-Day CRUD card. It renders the unified projection countdown list (`note-event` preferred, `legacy-dday` fallback with edit/delete). Hint guides users to create event notes with dates.

In day/agenda mode, the side-panel routine/task CRUD is hidden (interactive summaries live in Day view). Week/month modes retain full side-panel CRUD.

### Health (Priority 2)

**`HealthDashboardPanel`** aggregates at-a-glance data:

- **Nutrition:** protein progress bar, recent meals (fetches profile + intake)
- **Workout:** exercise count, set completion, lock status
- **Habits:** block + routine setup counts
- **Recovery:** InBody snapshot, rest-day indicator when workout is locked

Dashboard is the default Health section; workout/habits/recovery layouts no longer render beneath it.

### Scientific Notes (Priority 4)

- Workspace search (`buildWorkspaceSearch`) now matches `note.body` via `noteMatchesPlainSearch` (LaTeX source indexed).
- `MathBlock` user strings moved to i18n (`mathBlockEmpty`, `mathBlockPlaceholder`, etc.).

### UX Fixes (Priority 5)

- Context panel trash footer guarded with `activeNote` null check.
- Notes sidebar β badge removed.
- Sort menu / empty state emoji replaced with Lucide icons.

---

## 2. UX Audit Findings

| Area | Finding | K-50 action |
|------|---------|-------------|
| Schedule Day | Low density, read-only routines/tasks | Dashboard grid + interactive toggles |
| Schedule Agenda | Duplicated Day content | Events + deadlines + exceptions only |
| D-Day | Separate CRUD model | Unified countdown panel, note-first |
| Health Dashboard | Placeholder hint card | Real aggregated panel |
| Icons (Notes) | Emoji sort/empty states | Lucide Clock, Calendar, FileText |
| Math search | Workspace palette missed body | Body search wired |
| MathBlock | Hardcoded Korean strings | i18n keys added |
| Context panel | Crash on trash without active note | Guard added |
| Notes β badge | Unclear product signal | Removed |

**Deferred (K-51):** Dashboard card icons (Discovery/Timeline cards), shortcut help i18n unification, full D-Day legacy removal, align environment support for `\begin{align}`.

---

## 3. Files Created

| File | Purpose |
|------|---------|
| `calendar-ui/day/dayRoutineActions.ts` | Routine toggle action types |
| `calendar-ui/day/dayTodoActions.ts` | Task toggle action types |
| `calendar-ui/day/DayCountdownStrip.tsx` | Day view deadline strip |
| `calendar-ui/day/DayActivitySection.tsx` | Chronological activity feed |
| `calendar-ui/agenda/AgendaRoutineExceptionsSection.tsx` | Agenda routine exceptions |
| `ScheduleCountdownPanel.tsx` | Unified countdown side panel |
| `features/health/HealthDashboardPanel.tsx` | Health at-a-glance dashboard |
| `docs/K-50-deliverables.md` | This document |

---

## 4. Files Modified

| File | Changes |
|------|---------|
| `DayCalendarView.tsx` | Dashboard grid layout |
| `DayRoutineSummary.tsx` / `DayTodoSummary.tsx` | Interactive toggles |
| `dayCalendarPresentation.ts` | `buildDayActivityItems` |
| `AgendaCalendarView.tsx` | Agenda redesign |
| `AgendaCountdownSection.tsx` | i18n + note links |
| `CalendarShell.tsx` | Pass routine/todo actions |
| `PlannerView.tsx` | Countdown panel, hide side CRUD in day/agenda |
| `HealthView.tsx` | Dashboard panel, default section |
| `buildWorkspaceSearch.ts` | Body/LaTeX search |
| `MathBlock.tsx` | i18n strings |
| `NoteView.tsx` | β removal, icon consistency, context guard |
| `i18n.ts` | Schedule, health, math keys |
| `day/index.ts`, `agenda/index.ts` | Exports |
| `agendaView.test.ts` | Updated expectations |
| `buildWorkspaceSearch.test.ts` | Body search test |

---

## 5. Verification Results

```bash
npm run typecheck   # PASS
npm run build       # PASS
npm run test        # PASS (1871 tests)
```

---

## 6. Recommended K-51 Roadmap

1. **Schedule completion**
   - Inline routine/task add in Day dashboard (remove mobile-only gap)
   - Retire legacy D-Day API path; migration tool for existing records → event notes
   - Month view marked-date dots

2. **Health depth**
   - Lift protein data into shared SWR hook (avoid duplicate fetches)
   - Weekly workout volume chart on dashboard
   - Habit completion tracking (daily check-off for routine splits)

3. **Design system**
   - Lucide headers on Knowledge dashboard cards
   - Document icon size tiers (12 / 16 / 20px)
   - Unify shortcut help overlay + i18n

4. **Scientific notes**
   - `\begin{align}` and matrix environment QA pass
   - Math snippet toolbar i18n
   - Copy/paste LaTeX from external sources audit

5. **Quality**
   - Context panel empty states for graph/insights/actions tabs
   - Tag input Backspace integration test
   - Analytics legacy path test timeout hardening
