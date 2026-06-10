# Knowledge-18.2 — Visual Filter Builder Foundation

## Pre-Implementation Architecture Report

### Current state (post K-18.1)

```
DatabaseView { query, presentation, presentationConfig }
        ↓
filterByDatabaseView(view.query) → parseQuery → evaluateQuery → filterNotes
        ↓
prepareDatabaseViewPresentation (sort / group / bucket / card resolve)
        ↓
DatabaseViewPanel (controls + renderer)
```

| Component | Role |
| --------- | ---- |
| `parseQuery` / `evaluateQuery` | Single query engine — AND-only clauses |
| `visualFilterModels.ts` | Authoring types + compile helpers (K-18.0 scaffold) |
| `filterByDatabaseView` | View selection via `view.query` only |
| Saved Views / Rule Collections | Persist `query: string`; no visual UI |
| Smart Collections | Index evaluators — orthogonal |

### K-18.0 verdict (unchanged)

Visual filters **compile to query strings** and flow through the existing engine. No parallel filter AST or second evaluator.

### K-18.2 design

**Persistence:** `DatabaseTableConfig.visualFilters?: VisualFilterModel` (table cache — preserved across presentation switches like columns/sort).

**Evaluation:**

```
effectiveQuery = mergeQueryWithVisualFilter(
  mergeQueryWithVisualFilter(view.query, persistedVisualFilters),
  sessionFilter,  // ephemeral — DatabaseViewPanel state only
)
        ↓
parseQuery → evaluateQuery → filterNotes
```

**Compilation:** `compileVisualFilters()` → `compileVisualFilterToQueryString()` (alias).

**Clause mapping (Phase 1):**

| Visual kind | Compiled query token | Engine path |
| ----------- | -------------------- | ----------- |
| Property `=` | `status:active` | Indexed property |
| Property `!=` | `prop:status!=active` | Post-filter |
| Tag | `tag:japanese` | Indexed tag |
| Relation | `relation:course:"N1"` | Indexed relation |
| Formula | `formula:progress>80` | Formula post-filter |
| Metadata | `meta:updatedAt>2026-01-01` | Metadata post-filter |

Rollup filters deferred — no rollup query clauses today.

**UI:** `DatabaseFilterControls` in `DatabaseViewPanel` — add/remove/reorder Field / Operator / Value rows. Session refine filters are separate and not persisted.

**Saved Views / Rule Collections:** No schema changes; visual builder may compile to query strings when used on those forms in a future milestone.

### Risks

- Query engine extension for `meta:` / `prop:` tokens is additive — still single `parseQuery` / `evaluateQuery` path
- Controls monolith continues to grow; filter UI extracted to dedicated component

### Out of scope

Filter groups (OR/NOT), rollup filters, templates, new query engine
