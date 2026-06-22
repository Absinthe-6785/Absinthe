# K-125C — Health Performance & Progressive Rendering

Improve Health workspace perceived performance by deferring heavy sections
and reordering layout. Rendering and composition only — no data, store, or
projection logic changes.

## Immediate mount

- Exercise library (`ExerciseLibraryPanel`)
- Routine setup
- Workout calendar (`HealthCalendarPanel`)

## Deferred mount (IntersectionObserver)

- Analytics (`HealthDeferredMount` → `HealthAnalyticsPanel`)
- Supporting panels — InBody + protein (`HealthDeferredMount` → `HealthSupportingPanels`)

Calendar is extracted from supporting panels and mounts immediately after
today's workout.

## Default expansion

- Analytics panel: **collapsed**
- PR, recent sessions, exercise history: **collapsed** (unchanged)
- Summary grid: visible when analytics is expanded

## Layout order (right column)

1. Today's workout
2. Calendar
3. Analytics (history sections live here when expanded)
4. Supporting panels (InBody, protein)

Left column: library + routine (unchanged pairing).

## Empty states

- Workout empty state uses `data-k125c-empty-compact` wrapper to reduce vertical padding.

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm test -- k125c k107HealthPerformance k121HealthAnalytics k121Skeleton k120Memory
```

No changes to `buildHealthProjection`, `workoutMetrics`, stores, persistence,
hydration, or providers.
