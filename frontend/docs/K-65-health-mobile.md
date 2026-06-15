# K-65 Health Mobile

## Goal

Bring Health workspace to Schedule-level mobile quality.

## Changes

### Section swipe navigation

- `HealthView` wraps section content with `useSwipeNavigation`
- Order from `HEALTH_WORKSPACE_SECTIONS`: Dashboard → Nutrition → Workout → Habits → Recovery
- Enabled only when `useIsMobile()` is true
- Hint text: `healthSwipeSectionHint` below compact nav tabs

### Existing mobile polish (retained)

- Compact `HealthWorkspaceNav` with 44px touch targets
- Mobile workout tabs: blocks / routine / workout / protein
- Block edit/delete visible without hover (K-64)

### Empty states

- **Blocks:** `noBlocksEmpty` → opens create modal on tap (K-64)
- **Workouts:** `noWorkoutsEmpty` → tap switches to blocks tab (`setMobileHealthTab('blocks')`)

### i18n fixes

- `healthTapDeleteSet` — set delete tooltip
- `healthCopyWorkoutSummary` — clipboard button tooltip

## Desktop

Unchanged — full nav row, no swipe handlers active on large screens.

## Verification

- [ ] Swipe left advances section order
- [ ] Swipe right goes back
- [ ] Desktop nav click still works
- [ ] Workout empty tap opens blocks tab on mobile
