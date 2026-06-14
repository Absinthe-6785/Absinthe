# K-53 Health Review

## Dashboard Command Center

### Nutrition
- Daily intake vs target with progress bar
- Protein trend indicator (meets target / steady / below)
- Weekly average (7-day)
- Goal consistency (% days meeting target)
- Protein streak (consecutive days)

### Workout
- Today's exercise count and set progress
- Weekly training volume (unique session dates)
- Last exercise name
- PR highlight (week-over-week)
- Recent session list (last 2 dates + exercises)
- Click → workout section + mobile workout tab

### Habits
- Today's split-day routine (Day 1–N rotation)
- Inline mark-done toggle
- Streak + 30-day completion rate
- Momentum badge when streak ≥ 3
- Click → habits section + mobile routine tab

### Recovery
- InBody snapshot (weight, SMM, PBF)
- Average sleep from localStorage log (when logged)
- Latest recovery note (when logged)
- Rest day indicator when workout locked

## Data Layer

| Hook | Source |
|------|--------|
| `useProteinData` | SWR protein APIs |
| `useWorkoutRangeMetrics` | SWR workouts/range |
| `useHabitMetrics` | localStorage completions |
| `useRecoveryMetrics` | localStorage recovery log |

## Gap

Recovery log is read-only in dashboard — write UI deferred to K-54.
