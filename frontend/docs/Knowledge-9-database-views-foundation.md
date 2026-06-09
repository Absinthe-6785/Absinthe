# Knowledge-9 — Database Views Foundation (Pre-Implementation)

## Scope

Table-only database views as workspace entities. Reuses K-8.75 workspace infrastructure.

## Integration plan

```
DatabaseView { id, name, query, presentation: 'table' }
        ↓
filterByDatabaseView → filterNotes → KnowledgeIndexService
        ↓
DatabaseTableView (Title · Updated · Tags columns)
        ↓
WorkspaceActivation { kind: 'database-view', id }
```

## K-9 decisions

- **WorkspaceActivation** replaces separate nullable IDs in `NoteView`
- **No second query engine** — all row resolution via `filterNotes`
- **Persistence** — separate `note-database-views-v1` key
- **Presentation** — table replaces note list panel when active; editor remains for row selection

Full workspace context: `Knowledge-8.75-workspace-architecture-review.md`
