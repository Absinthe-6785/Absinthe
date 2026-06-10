# Knowledge-17.5 — Timeline View Foundation

## Scope

Adds **Timeline** as a fourth database presentation on the existing `DatabaseView` + `presentationConfig` architecture. Phase 1 covers configuration, item resolution, month navigation, and note selection — no zoom, drag-and-drop, dependencies, or timeline-specific formulas/rollups.

## Architecture

```
DatabaseView { presentation: 'timeline', presentationConfig: DatabaseTimelineConfig }
        ↓
filterByDatabaseView → filterNotes (unchanged)
        ↓
prepareDatabaseTimelineItems → TimelineItem[]
        ↓
DatabaseTimelineView (month nav + item list)
        ↓
WorkspaceActivation { kind: 'database-view', id }
```

| Component | Role |
| --------- | ---- |
| `DatabaseTimelineConfig` | Persisted start/end date property keys |
| `prepareDatabaseTimelineItems` | Post-filter date range resolution |
| `TimelineItem` | Resolved row: noteId, title, startDate, endDate |
| `DatabaseTimelineView` | Horizontal day axis, prev/next/today, item cards |
| `DatabaseViewPanel` | Presentation switcher + timeline controls + renderer |

## Config

```typescript
interface DatabaseTimelineConfig {
  type: 'timeline';
  startDateProperty: string;   // e.g. "startDate", "updatedAt"
  endDateProperty?: string;    // optional — single-day when omitted
  sortBy?: 'start' | 'end' | 'title';
}
```

Defaults: `startDate` / `endDate`. Reuses `getNoteDateValue()` calendar parsing (`YYYY-MM-DD`, ISO datetime, `updatedAt`, `createdAt`). Invalid or missing start dates exclude the note.

## User capabilities

- Create database views as Table, Board, Calendar, or Timeline
- Configure start/end date properties in controls and create form
- Switch between all four presentations (table config preserved)
- View notes on a month-scoped timeline with title, date range, and tags
- Click items to open/select notes (same as other presentations)

## Deferred (not in K-17.5)

Zoom, drag-and-drop scheduling, dependencies, Gantt charts, timeline formulas/rollups, timeline filters, timeline grouping, gallery view.

## Validation

- `npm run typecheck` PASS
- `npm test` PASS
- `npm run build` PASS
