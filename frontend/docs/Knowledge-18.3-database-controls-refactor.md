# Knowledge-18.3 — Database Controls Refactor

## Pre-Implementation Architecture Report

### Current state (post K-18.2)

`DatabaseViewControls.tsx` (~890 lines) combines:

| Concern | Lines (approx) |
| ------- | -------------- |
| Presentation switcher | Shared |
| Board / Calendar / Timeline / Gallery config | Per-presentation branches |
| Table columns, sort, rollups, formulas | Table branch |
| `DatabaseViewPanel` | Session filters, filter UI, renderer dispatch |

### K-18.0 recommendation

Keep `DatabaseViewPanel` as unified entry point. Extract presentation-specific control modules. No schema or persistence changes.

### K-18.3 target

```
DatabaseViewPanel
├── DatabaseViewControls (router)
│   ├── SharedDatabaseControls
│   └── TableViewControls | BoardViewControls | …
├── DatabaseFilterControls (query-level; always visible — unchanged)
└── DatabasePresentationRenderer
```

### Refactor rules

- Pure structural extraction — no behavior changes
- Existing exports (`DatabaseViewPanel`, `DatabaseViewControls`, prop types) preserved via re-exports
- Filter UI remains panel-level (applies to all presentations via `view.query`)

### Out of scope

Templates, new presentations, new database features
