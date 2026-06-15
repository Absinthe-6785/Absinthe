# K-67 Health Integration

## Problem

Workout, Nutrition, and Recovery each needed a consistent path to the same daily note without losing the Health navigation stack.

## Solution: one day log per date

`lib/healthDayNotes.ts`:

- Title = `YYYY-MM-DD` (calendar date string)
- `isHealthDayNoteTitle()` detects day logs for context banner

`openHealthDayNote()` in `noteNavigation.ts`:

1. Finds existing non-deleted note with matching title, or creates one
2. Sets `returnTab: 'health'`
3. Sets breadcrumb (default: Workout → Open day log)

## UI wiring (`HealthView`)

| Section | Entry | Breadcrumb |
|---------|-------|------------|
| Workout | "Open day log in Notes" button | Workout → Open day log |
| Nutrition | `ProteinTracker` footer button | Nutrition → Open day log |
| Recovery | `RecoveryLogPanel` footer button | Recovery → Open day log |

All three call `openHealthDayLog(section)` which delegates to `openHealthDayNote` with section-specific breadcrumb keys.

## Context banner

When viewing a `YYYY-MM-DD` titled note, `WorkspaceContextBanner` shows a **Health day log** chip. If opened from Health (`returnTab === 'health'`), the chip returns to Health.

## Navigation stack preserved

- Cross-tab open uses `navigateToNoteWithHistory` with source `health`
- K-66 session stack persists across refresh
- Return chip restores Health tab without clearing workout/nutrition/recovery section state

## Tests

`noteNavigation.test.ts`:

- Creates new day note with correct title and return path
- Reuses existing day note without calling `createNote`
