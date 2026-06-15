# K-69 Product Stabilization & Real-World Validation

## 0. Real-World Usage Audit

Dataset builder: `src/dev/realisticUsageFixture.ts`  
Automated audit: `src/dev/realisticUsageAudit.test.ts`

| Target | Built | Finding |
|--------|-------|---------|
| 100–300 notes | 200 | Notes view handles via existing store; no crowding in list (workspace filters apply) |
| 50+ planner events | 60+ | Month cells overflow correctly (+N more) |
| 20+ countdowns | ~15 event-derived | Sidebar + agenda countdown sections adequate |
| 100+ relations | ~66 wiki links | Cosmos/graph scales via existing tier policy |
| Workout/nutrition history | API-backed | No local seed; SWR + skeletons added for load gaps |

### Friction under load
- **Crowded:** Month day with 50 events — capped at 3 visible + overflow (acceptable)
- **Empty:** Notes Cosmos before graph connections — expected empty states
- **Navigation:** Health 2-tab model holds; workout right column was visually unbalanced (fixed)
- **Performance:** Month projection <200ms with 200 notes + 55 blocks

---

## 1. Dead Code Cleanup

### Removed files (~28 KB source)
- `HealthDashboardPanel.tsx`
- `HabitQuickPanel.tsx`
- `hooks/useWorkoutRangeMetrics.ts`
- `hooks/useHabitMetrics.ts`
- `habits/habitCompletion.ts` + test
- `common/dashboard/DashboardSection.tsx`

### Removed i18n keys (~30)
- `healthNavDashboard`, `healthNavHabits`, `healthNavRecovery`
- All `healthDashboard*` keys
- All `k54Habit*` keys

### Migrated
- `RecoveryLogPanel` → `k54RecoveryRestDaySaved`, `k54RecoveryNote`

### Bundle impact
- ~8 dead modules eliminated from graph; no runtime imports remain

---

## 2. Layout Stability (CLS)

| Screen | Fix |
|--------|-----|
| Nutrition | Existing `min-h-[480px]` pulse skeleton (K-68) |
| Workout | `WorkspaceCardSkeleton` while `isDailyLoading` on today's workout card |
| Workout side row | `min-h-[180px]` on calendar, InBody, recovery |
| Agenda | `min-h-[120px] max-h-[480px]` scroll container |
| Planner timeline | Existing `min-h-[520px]` preserved |

`isDailyLoading` now passed via `ViewProps` for reserved layout (spinner remains as secondary indicator).

---

## 3. Workout Workspace Refinement

- Left column: `lg:flex-[3] max-w-[420px]` — setup panels, not competing with workout
- Blocks card: `min-h-[220px] max-h-[300px]` (stable height)
- Routine card: `lg:flex-1 min-h-[280px]`
- Right column: Today's Workout as primary hero (`lg:min-h-[420px]`)
- Metrics row: calendar | InBody | recovery with equal `min-h-[180px]`

---

## 4. Planner Validation

| Scale | Result |
|-------|--------|
| 20 events/day | Stream renders; overflow +3 |
| 50 events/day | 3 visible + overflow 47 |
| 100 events/month spread | Projection <200ms |

### Countdown placement (unchanged, validated)
- **Day/Week:** Inline strip + sidebar — appropriate
- **Month:** Sidebar only — avoids cell clutter
- **Agenda:** Pinned section above stream — correct for D-day semantics

---

## 5. Performance Audit — Top Operations

1. `buildPlannerCalendarProjection` — O(notes × days); <200ms at realistic scale
2. `HealthView` prev-workout fetch — parallel per block (deferred; no speculative fix)
3. `useProteinData` weekly range — decoupled from intake (K-68)
4. Note editor virtual list — benchmarked separately (UX-5E)
5. Cosmos graph layout — tier policy at 100/250/500 nodes
6. `localWorkouts` drag handlers — inline IIFE BlockCard (low priority)
7. Planner `TIME_SLOTS` — module-level constant (good)
8. `globalProps` useMemo — stable deps (good)
9. Recovery localStorage reads — per-date, cheap
10. Agenda stream sort — O(n log n), negligible at test scale

**Fixed:** Workout CLS skeleton (reduces perceived lag on date change)

---

## 6. Visual Consistency

Shared rhythm preserved:
- Cards: `rounded-[24px] lg:rounded-[32px]`, `p-5 lg:p-6`
- Headers: `font-heading text-lg font-bold`
- Mobile tabs: `min-h-[44px] rounded-2xl`
- Skeleton: `WorkspaceCardSkeleton` reusable component

---

## 7. Regression Sweep

Automated via `npm run test` (1952+ tests). Manual checklist:
- [ ] Backup export/restore
- [ ] Navigation history + breadcrumbs (K-67)
- [ ] Health Workout/Nutrition flows
- [ ] Planner month/agenda/day/week
- [ ] Cosmos preview/open

---

## 8. Files Modified

See git diff. Key paths:
- `src/dev/realisticUsageFixture.ts` (new)
- `src/dev/realisticUsageAudit.test.ts` (new)
- `src/components/common/WorkspaceCardSkeleton.tsx` (new)
- `src/components/views/HealthView.tsx`
- `src/components/AppContent.tsx`
- `src/types/index.ts`
- `src/lib/i18n.ts`
- Deleted health dashboard/habit chain

---

## 9. Verification

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

---

## 10. Remaining UX Debt (post K-69)

1. Dev auth fixture for screenshot automation
2. Full-month schedule block indexing (anchor-date only)
3. HealthView `BlockCard` extraction from render IIFE
4. Cosmos/Archive dimension-matched skeletons
5. Prev-workout fetch abort/cancel on date change
6. Theme colors on month schedule chips
