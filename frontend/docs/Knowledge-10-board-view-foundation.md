# Knowledge-10 — Board View Foundation (Pre-Implementation)

## Scope

Kanban-style board presentation for Database Views. Presentation layer only — note selection unchanged.

## Architecture

```
DatabaseView { query, presentation, presentationConfig }
        ↓
filterByDatabaseView → filterNotes (unchanged)
        ↓
presentation === 'table' → sortDatabaseViewRows → DatabaseTableView
presentation === 'board' → groupNotesByProperty → DatabaseBoardView
```

## K-10 decisions

- Lift K-9.5 `columns`/`sort` into `presentationConfig.table`
- Board config: `{ type: 'board', groupBy: string }`
- Grouping via Properties API / `KnowledgeIndexService.getProperties()` — no board index
- `WorkspaceActivation { kind: 'database-view' }` unchanged

See `Knowledge-9.75-database-architecture-review.md` for full context.
