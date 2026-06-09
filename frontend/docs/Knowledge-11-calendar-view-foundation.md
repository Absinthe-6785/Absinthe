# Knowledge-11 — Calendar View Foundation (Pre-Implementation)

## Scope

Monthly calendar presentation for Database Views. Presentation layer only — note selection unchanged.

## Architecture

```
DatabaseView { query, presentation, presentationConfig }
        ↓
filterByDatabaseView → filterNotes (unchanged)
        ↓
presentation === 'table' → sortDatabaseViewRows → DatabaseTableView
presentation === 'board' → groupNotesByProperty → DatabaseBoardView
presentation === 'calendar' → bucketNotesByDate → DatabaseCalendarView
```

## K-11 decisions

- Calendar config: `{ type: 'calendar', dateProperty: string, unscheduledLabel? }`
- Date bucketing via Properties API + built-in `updatedAt` — no date index
- `WorkspaceActivation { kind: 'database-view' }` unchanged
- Month navigation (prev / next / today) in `DatabaseCalendarView` — no weekly or agenda views

## Date parsing policy

| Input | Behavior |
| ----- | -------- |
| `updatedAt` (builtin) | `note.updatedAt` milliseconds → local calendar day |
| `createdAt` (builtin) | Optional `note.createdAt` ms, else property string |
| `YYYY-MM-DD` | Parsed as local calendar date (no timezone shift) |
| `YYYY-MM-DDTHH:mm:ssZ` | Parsed as instant → local calendar day |
| Numeric string (ms) | Parsed as timestamp → local calendar day |
| Other strings | `Date.parse` fallback; invalid → **No Date** bucket |
| Empty / invalid | Placed in **No Date** bucket (configurable label) |

## Out of scope

Weekly view, agenda view, recurring tasks, drag-and-drop scheduling, reminders, timeline.

See `Knowledge-9.75-database-architecture-review.md` for full context.
