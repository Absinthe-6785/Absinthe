# Knowledge-9.5 — Database View Operations (Pre-Implementation)

## Scope

Extend K-9 Database Views with column configuration and row sorting. Query semantics unchanged.

## Architecture

```
DatabaseView { query, columns[], sort }
        ↓
filterByDatabaseView → filterNotes (unchanged)
        ↓
sortDatabaseViewRows(notes, sort, KnowledgeIndexService)
        ↓
resolveVisibleColumns(view) → DatabaseTableView
```

- **Column values** — built-in keys (`title`, `updatedAt`, `tags`) + property keys via `KnowledgeIndexService.getProperties()`
- **Sorting** — post-filter only; does not affect query evaluation
- **Persistence** — columns + sort stored on `DatabaseView` in existing `note-database-views-v1` key
- **Backward compatibility** — views without `columns`/`sort` receive defaults (all built-ins visible, `updatedAt desc`)

WorkspaceActivation and resolveWorkspaceFilter unchanged.
