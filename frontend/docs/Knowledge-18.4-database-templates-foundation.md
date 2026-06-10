# Knowledge-18.4 — Database Templates Foundation

## Pre-Implementation Architecture Report

### Current state (post K-18.3)

- `createDatabaseView()` — minimal presets (presentation + one config field)
- `DatabaseViewsSection` — manual name/query/presentation create form
- `DatabaseTableConfig` — columns, sortRules, visualFilters (table cache)
- Non-table views store column/sort cache at root; filters resolve via `getTableConfig()`

### K-18.0 verdict

Templates are **code-defined factories**, not persisted entities. Flow:

```
DatabaseTemplateDefinition.createView()
        ↓
withPresentationDefaults()
        ↓
createDatabaseViewFromTemplate() → append to views[]
        ↓
saveDatabaseViews() (DatabaseView only)
```

### K-18.4 design

- `DatabaseTemplateDefinition` with `createView(): DatabaseView`
- `DATABASE_TEMPLATES` registry (6 built-in presets)
- `createDatabaseViewFromTemplate(views, templateId)` — validates query, normalizes, appends
- UI: "Choose template" picker in `DatabaseViewsSection`
- Table templates: full columns + sortRules + visualFilters on `presentationConfig`
- Non-table templates: property columns in table cache; filters in query when needed

### Out of scope

User templates, export/import, marketplace, versioning
