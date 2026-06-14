# K-54 Habit Workflow

## Storage

- Key: `absinthe:habit-completions`
- Shape: `{ "${date}:${habitId}": true }`
- Event: `absinthe:habit-completion-changed`

## Quick actions (`HabitQuickPanel`)

| Action | Behavior |
|--------|----------|
| Complete | `setHabitCompleted(id, date, true)` |
| Undo | `setHabitCompleted(id, date, false)` |
| Edit routine | Scrolls mobile tab to routine / opens routine setup |
| History grid | 14-day toggle buttons (tap to flip day) |

## Dashboard shortcuts

- Habit card: inline Mark done / Done toggle (unchanged)
- Deep-link: `onOpenRoutine` → Habits section + routine tab

## Metrics

- Streak: backward from selected date
- Completion rate: 30-day lookback
- History count: completed days in 14-day window

## K-55

- Backend persistence for completions
- Per-habit history calendar view
- Multiple habit types beyond split-day routine
