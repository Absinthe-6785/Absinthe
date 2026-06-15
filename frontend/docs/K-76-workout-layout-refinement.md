# K-76 — Workout Layout & Schedule Density Refinement

Presentation-only polish. No workout logging, data model, or workflow changes.

## Workout layout (before → after)

| Area | Before | After |
|------|--------|-------|
| Column split | ~32% / ~68% | **~38% / ~62%** (`lg:w-[38%]`, `max-w-[420px]`) |
| Workout Library | `max-h-[280px]`, loose chips | `max-h-[340px]`, tighter chips + **set count** |
| Routine Setup | Stacked day cards, name pills | **2-column grid**, exercise + set count rows |
| Today's Workout | `min-h-[420px]` hero | `WORKSPACE_CARD.workoutHero` — list-focused |
| Routine load | Always 1 default set | **Previous session set count** via `/api/workouts/prev` |
| Protein compact | Progress bar + timeline | **Current / Goal / Left** grid + quick-add only |

## Schedule density

- **Day / Week detail**: `suppressEmptySections` — one combined empty hint, no triple placeholders
- **Event rows**: `min-h-[36px]`, tighter gaps
- **Countdown rows**: matching compact row height
- **Week grid card**: `p-4` (was `p-6`)
- **Month cells**: timed events show **time + title**
- **Schedule modal**: Title → Date → Time → Category → Color → Save; cohesive color palette; metadata-style category buttons

## Color palette (global `THEME_COLORS`)

Refined saturation for schedule/recipe: amber-600, sky-600, emerald-600, violet-600, rose-500, slate-500.

## Files modified

| Area | Files |
|------|-------|
| Workout | `HealthView.tsx`, `workoutSetCount.ts`, `workspaceCardSizes.ts` |
| Nutrition | `ProteinTracker.tsx` |
| Schedule | `DayCalendarView.tsx`, `DayEventsSection.tsx`, `DayCountdownStrip.tsx`, `DayScheduleTimeline.tsx`, `DayHeader.tsx`, `SelectedDayDetailPanel.tsx`, `WeekCalendarView.tsx`, `MonthCalendarCell.tsx`, `PlannerView.tsx` |
| Theme | `AppContent.tsx` |
| i18n | `i18n.ts` |
| Tests | `workoutSetCount.test.ts` |

## Remaining UX debt

- Month cells still omit per-day countdown chips (would need projection extension)
- Routine set counts are inferred from history, not stored per-routine template
- CalendarShell `min-h-[480px]` may still feel tall on sparse months
- Week column countdowns not shown (detail panel only)

## Verification

```bash
npm run typecheck
npm run build
npm run test
```

Manual QA: Workout Library → Routine → Load → Log; Protein quick-add; Schedule day/week/month + modal.
