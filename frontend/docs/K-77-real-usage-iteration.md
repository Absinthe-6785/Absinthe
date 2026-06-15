# K-77 Real Usage Iteration & Workspace Refinement

Polish-only release aligned with long-term usage after K-68–K-76. No new features, schema changes, or workflow redesign.

## 1. Workout Workspace Refinement

### Workout Library
- **Removed** set counts from library chips (K-76 incorrectly showed them on exercises).
- Library shows exercise names only; cardio never shows set labels.
- Left column widened: `38% / 420px` → `42% / 480px` for fewer chip wraps.

### Routine Setup
- Set counts remain in the 2×2 day grid: `Exercise Name | Planned Sets`.
- **New client-side storage** (`routinePlannedSets.ts`, localStorage key `healthRoutinePlannedSets`) maps `{ dayName → { blockId → count } }` without API/schema changes.
- Assemble modal: vertical ordered rows with drag reorder + per-exercise set count (non-cardio only).
- Routine load uses routine planned count first, then previous-session fallback (K-76 behavior preserved).

### Today's Workout
- Logging (reps, weights, drop sets, prev comparison, save) untouched.
- Width rebalance: slightly more space to library + routine; hero remains dominant.

### Bottom Row
- Grid: `1.45fr | 0.5fr | 1fr` (Calendar | InBody | Nutrition).
- InBody: narrow vertical stack (Weight, SMM, PBF). No visceral fat in schema.
- Calendar and Nutrition gain width from InBody reduction.

## 2. Schedule Density

### Day View
- Compact empty: `No scheduled events.` (`k77ScheduleEmptyCompact`).
- Populated: unified `DayAgendaList` — schedules, events, countdowns in one dense chronological list (`min-h-[32px]` rows).

### Week View
- Reduced padding/gaps on week card and detail panel.

### Month View
- Cells show time + title on events; countdown badge (`D-N`) when `targetDate` matches cell.
- `+N more` overflow includes countdown overflow.

### Right Panel (month + week)
- `SelectedDayDetailPanel` uses `DayAgendaList` for chronological Events / Deadlines / Countdowns.

## 3. Schedule Modal Polish

- Hierarchy preserved: Title → Date → Time → Category → Color → Save.
- Categories: smaller buttons (`text-[9px]`, `py-1.5`), reduced opacity when unselected.
- Colors: slightly smaller swatches (`w-7 h-7`); palette unchanged from K-76 (600-weight, dark-theme friendly).

## 4. Archive Verification (K-71/K-72)

**Finding:** Archive `ArchiveUnifiedView` already implements K-71/K-72 dense 2×2 grid with `WORKSPACE_CARD` sizing. No code changes required.

- Area pills, browse links, mark calendar, milestones share consistent card rhythm.
- Remaining debt: browse links could use tighter vertical padding on very wide viewports (cosmetic).

## 5. Schedule Verification vs K-76

| Area | K-76 claim | K-77 actual change |
|------|------------|-------------------|
| Day empty | Combined hint | Shorter copy + less padding |
| Day populated | 36px rows | Unified agenda list at 32px |
| Week detail | suppressEmptySections | Same + tighter shell padding |
| Month cells | Time on events | + countdown badges, overflow includes countdowns |
| Modal | Reordered fields | Category/color de-emphasized |

## 6. UI Consistency Sweep

- Schedule panels: `gap-2`, `p-2.5 lg:p-3` aligned with K-75 card rhythm.
- Health InBody uses compact header + vertical metric stack.
- Action buttons unchanged (K-75 tokens not re-applied to Health assemble modal — existing patterns retained).

## Files Modified

| File | Change |
|------|--------|
| `routinePlannedSets.ts` | New localStorage planned set counts |
| `routinePlannedSets.test.ts` | Unit tests |
| `workoutSetCount.ts` | `buildSetsFromPlannedCount` |
| `HealthView.tsx` | Library, routine, InBody, grid, assemble modal |
| `DayAgendaList.tsx` | New dense chronological list |
| `SelectedDayDetailPanel.tsx` | Uses DayAgendaList |
| `DayCalendarView.tsx` | Tighter padding |
| `WeekCalendarView.tsx` | Tighter padding/empty hint |
| `monthCalendarPresentation.ts` | Countdown rows in cells |
| `MonthCalendarGrid.tsx` | Pass countdowns |
| `MonthCalendarCell.tsx` | Render countdown badges |
| `MonthCalendarView.tsx` | Wire countdowns |
| `PlannerView.tsx` | Modal category/color de-emphasis |
| `dayScheduleExecution.test.ts` | Day view wiring update |
| `i18n.ts` | `k77ScheduleEmptyCompact`, `setsLabel` |

## Verification

```bash
cd frontend && npm run typecheck && npm run build && npm run test
```

Manual QA: Workout Library, Routine Setup, Routine Editing, Load Routine, Workout Logging, Protein Quick Add, Schedule Day/Week/Month, Schedule Modal, Archive.

## Remaining UX Debt After K-77

1. Routine planned sets are localStorage-only — no cross-device sync (by design for K-77).
2. Month cell countdown shows label only (not title) due to space — full detail in right panel.
3. Schedule block edit/delete moved out of dense agenda list (read-only blocks in list; add via FAB).
4. Visceral fat metric not in API — omitted from InBody panel.
5. Archive wide-screen empty margins unchanged.
