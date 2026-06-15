# K-72 Workspace Unification

Branch: `k72-workspace-unification`

## Goal

Every major workspace follows the same structural model: consistency, density, predictability, visual hierarchy. No new features, storage changes, or architectural rewrites.

---

## Part 1 — Unified Workspace Layout

`frontend/src/components/common/workspaceLayout.tsx`:

| Zone | Role |
|------|------|
| Header | Title, mode switchers, period navigation |
| Primary | Main working surface |
| Secondary | Setup / library / context (optional split column) |
| Supporting | History, compact pickers, metrics |

Applied to:

- **Schedule** — `CalendarShell` via `WorkspaceLayout`
- **Archive** — `ArchiveUnifiedView` via `WorkspaceLayout`
- **Health** — `data-workspace="health"` + supporting zone grid
- **Nutrition** — `ProteinTracker` + `WORKSPACE_CARD.hero`
- **Notes** — existing chrome; knowledge panels consolidated (Part 6)

---

## Part 2 — Schedule Unification

- **Day** — `SelectedDayDetailPanel` with `bare` (no nested card); full variant
- **Week** — week grid + bare detail timeline below
- **Month** — 50/50 split (`lg:grid-cols-2`); `variant="month"` hides routines/tasks
- **CalendarShell** — reserved `WORKSPACE_CARD.lg` + `min-h-[480px]` for layout stability

---

## Part 3 — Workout Rebuild

- **Left:** Routine Setup + Workout Library (renamed from Blocks)
- **Right primary:** Today's Workout (hero)
- **Supporting row:** Workout History (`WorkoutHistoryPanel`) | Compact week calendar | InBody

New components:

- `WorkoutHistoryPanel.tsx` — month session list from `/api/workouts/range`
- `CompactWorkoutCalendar.tsx` — week strip + month nav

Removed oversized desktop month grid.

---

## Part 4 — Archive Density

- 2×2 grid: Recent Transitions | Areas | Timeline | Browse
- Smaller section padding (`p-4`/`p-3`), compact titles (`text-sm`)
- Timeline + browse links as inline chips
- Targets above-the-fold visibility on 1440p

---

## Part 5 — Card System Rollout

`WORKSPACE_CARD` applied to:

- Health (workout, history, calendar, InBody)
- Nutrition (`hero`)
- Archive (sm/md sections)
- Schedule shell (`lg` reserved height)

---

## Part 6 — Knowledge Consolidation

- **Discovery** — hide `VaultHealthStrip` when `isolated-notes` section is non-empty
- **Related Notes** — remove duplicate reason summary line (badges only)
- **Dashboard** — skip `KnowledgeEvolutionCard` when activity card shown; skip `TimelineDashboardCard` when activity summary present

---

## Part 7 — Layout Stability

- `CalendarShell`: `min-h-[480px]` on primary zone
- `MonthCalendarView`: `min-h-[420px]` on split grid
- `ProteinTracker` / workout skeleton: `WORKSPACE_CARD.hero`

---

## Verification

```bash
npm run typecheck
npm run build
npm run test
```

---

## Remaining UX Debt

- Health workout column not yet wrapped in `WorkspaceLayout` split (manual grid retained for mobile tabs)
- Notes editor shell not fully zoned (large surface; incremental only)
- Month cell inline note badges not added (events section covers note-backed items)
- Knowledge Timeline overview still dense internally (CosmosEvolutionStory vs summary)
