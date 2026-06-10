# Knowledge-18.0 — Advanced Sorting & Visual Filter Architecture Review

## Scope

Architecture-only milestone. Evaluates multi-column sorting, visual filter builder UX, query engine unity, database-specific filters, controls scaling, and template preparation **before implementation**. **No user-facing features, no behavior changes, no UI changes.**

Evidence base: Query Engine (K-7/K-16.5), Database Layer (K-9–K-17.75), Workspace (K-8.75), Formula/Rollup layers (K-15/K-16).

---

## Pre-Implementation Architecture Report

### Current state (post K-17.75)

```
DatabaseView { id, name, query, presentation, presentationConfig }
        ↓
filterByDatabaseView → filterNotes(parseQuery → evaluateQuery)
        ↓
prepareDatabaseViewPresentation (dispatch by presentation)
  table    → sortDatabaseViewRows (single rule) → DatabaseTableView
  board    → groupNotesByProperty → DatabaseBoardView
  calendar → bucketNotesByDate → DatabaseCalendarView
  timeline → prepareDatabaseTimelineItems → DatabaseTimelineView
  gallery  → prepareDatabaseGalleryItems → DatabaseGalleryView
        ↓
DatabaseViewPanel (monolithic controls + renderer)
        ↓
WorkspaceActivation { kind: 'database-view', id }
```

| Capability | Status |
| ---------- | ------ |
| Table / Board / Calendar / Timeline / Gallery | ✅ |
| Single table sort (`DatabaseViewSort`) | ✅ |
| Query string selection (`view.query`) | ✅ |
| Formula query clauses (`formula:key>80`) | ✅ K-16.5 |
| Saved Views / Rule Collections (query string) | ✅ |
| Smart Collections (index evaluator) | ✅ orthogonal |
| Multi-column sort | ❌ |
| Visual filter builder | ❌ |
| Database templates | ❌ |
| Session-only UI filters | ❌ |

### Validated layering (unchanged)

**Selection** (who is in the set) lives in the Query Engine via `view.query`. **Presentation transforms** (sort, group, bucket, card resolve) live in post-filter prepare pipelines. **Workspace** activates entities; it does not own filter semantics.

---

## Deliverable 1 — Architecture Report Summary

The current architecture **supports K-18 goals without redesign**. Advanced sorting is a localized table-presentation extension. Visual filters are an **authoring layer** over the existing query string AST. Templates are a **factory module** producing standard `DatabaseView` records.

**Reject:** parallel filter engine, separate Gallery/Database filter types, new workspace kinds for templates.

---

## Deliverable 2 — Advanced Sorting Recommendation (Q1, Q7)

### Current model

```typescript
interface DatabaseViewSort {
  key: string;
  direction: 'asc' | 'desc';
}
// DatabaseTableConfig.sort — single rule
```

### Recommended data model

```typescript
interface DatabaseViewSortRule {
  key: string;
  direction: 'asc' | 'desc';
}

interface DatabaseTableConfig {
  type: 'table';
  sort: DatabaseViewSort;              // legacy shorthand — keep
  sortRules?: DatabaseViewSortRule[];  // K-18+ primary when present
  // ...columns, rollupColumns, formulaColumns
}
```

Example persisted order:

```json
[
  { "key": "status", "direction": "asc" },
  { "key": "priority", "direction": "desc" },
  { "key": "updatedAt", "direction": "desc" }
]
```

### UI model

- **Table-only** multi-row sort editor in table controls (not board/calendar/timeline/gallery in Phase 1).
- Each row: column key dropdown (built-in + property columns; K-18.5+ optional rollup/formula keys) + direction toggle.
- Drag-to-reorder rules (optional polish).
- Timeline retains isolated `sortBy` (`start` | `end` | `title`) — separate concern.

### Execution order

1. `filterByDatabaseView` (unchanged)
2. `sortDatabaseViewRows(notes, sortRules, service)` — **lexicographic compare**:
   - For each rule in order, compare `getDatabaseRowSortValue(note, rule.key, service)`
   - On tie, advance to next rule
   - Final tie-break: `title` ascending (preserve current behavior)
3. Render sorted rows

### Persistence & backward compatibility

| Scenario | Behavior |
| -------- | -------- |
| Legacy view with `sort` only | `migrateLegacySortToSortRules(sort)` → `[sort]` at read time |
| New multi-sort saved | Write `sortRules`; sync `sort = sortRules[0]` for legacy clients |
| `normalizeDatabaseViews` | Accept either; canonicalize via `withPresentationDefaults` |
| Presentation switch | Table sort cache preserved (same pattern as K-10 board switch) |

Scaffold: `databaseSortFutureModels.ts` — `normalizeDatabaseViewSortRules`, `migrateLegacySortToSortRules`, `primarySortRule`.

**Severity:** Low. Localized to table prepare pipeline. No Query Engine changes.

---

## Deliverable 3 — Visual Filter Builder Recommendation (Q2, Q4, Q5)

### Question: Generate query strings (A) or second filtering engine (B)?

### Verdict: **Option A — Visual builder compiles to query strings**

| Approach | Verdict |
| -------- | ------- |
| **A — Visual → query string / ParsedQuery** | ✅ **Recommended** |
| **B — Parallel filter AST + second evaluator** | ❌ **Reject** |

**Justification:**

- Saved Views, Rule Collections, and Database Views all persist `query: string`
- K-16.5 formula predicates are already query clauses
- AND semantics are defined; visual rows map 1:1 to `QueryClause` variants
- Single evaluation path preserves count consistency, workspace behavior, and test coverage

### FilterCondition model

```typescript
interface FilterCondition {
  kind: 'tag' | 'property' | 'formula' | 'hasRelation' | 'linkedTo' | 'relation';
  field?: string;       // property / formula / relation key
  operator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
  value: string | number;
}
```

### Compilation path

```
VisualFilterModel
  → compileVisualFilterToParsedQuery()
  → formatParsedQuery()
  → view.query (persisted)
  → parseQuery() → evaluateQuery() → filterNotes()
```

Example UI rows → query string:

| Visual row | Compiled clause |
| ---------- | --------------- |
| `[Status] [=] [Active]` | `status:active` |
| `[Tag] [=] [japanese]` | `tag:japanese` |
| `[Progress] [>] [80]` | `formula:progress>80` |
| `[Relation] [course] [→] [N1]` | `relation:course:"N1"` |

Scaffold: `query/visualFilterModels.ts` — types, normalizers, `compileFilterConditionToClause`, round-trip tests.

### Exposing field kinds in UI (Q5)

| Kind | Visual builder | Query clause | Notes |
| ---- | -------------- | ------------ | ----- |
| **Properties** | Field picker + value | `key:value` | Equality only today |
| **Tags** | Tag picker | `tag:value` | |
| **Relations** | Relation key + target title | `relation:key:"title"` | Quote titles with spaces |
| **Has relation** | Relation key toggle | `hasRelation:key` | |
| **Linked to** | Note title search | `linkedTo:title` | |
| **Formulas** | Formula column picker + numeric comparator | `formula:key>80` | Requires formula catalog context |
| **Rollups** | **Defer** or expose as computed formula-like rows in K-18.5+ | No rollup clause today | Rollups are presentation-computed; not indexed |

Formula filter UI must source column definitions from:

- **Database View context:** `getTableConfig(view).formulaColumns`
- **Global search context:** `buildFormulaQueryCatalog(databaseViews)`

Rollup filters should **not** bypass the query engine until rollup clauses are explicitly added to `QueryClause` (future milestone).

---

## Deliverable 4 — Query Engine Recommendation (Q3)

### Verdict: **Single engine for all string-based selection**

| Consumer | Filter path | Formula context |
| -------- | ----------- | --------------- |
| Database View | `filterByDatabaseView` → `filterNotes(view.query)` | View-local `formulaColumns` |
| Rule Collection | `filterByRuleCollection` → `filterNotes` | Global catalog |
| Saved View | Search input → `filterNotes` | Global catalog |
| Smart Collection | `evaluateSmartCollection` | N/A — **not query-based** |
| Visual builder output | Compiled string → same paths | Same as target entity |

Smart Collections remain **orthogonal** — index evaluators, not part of `parseQuery`. Do not force them into the visual builder in K-18.

**Extension point for new clause types:** `queryModels.ts` → `parseQuery` → `evaluateQuery` → `KnowledgeIndexService`. Formula-like computed clauses follow post-filter pattern in `evaluateFormulaQuery.ts`.

---

## Deliverable 5 — Database Filter Recommendation (Q6)

### Question: Local database filters vs query-only?

### Verdict: **Hybrid — persisted query + optional session overlay**

| Filter type | Storage | Evaluation |
| ----------- | ------- | ------------ |
| **Database query** (`view.query`) | Persisted on `DatabaseView` | `filterByDatabaseView` |
| **Temporary UI filters** | Session/component state only | Merge at prepare time |

Recommended session overlay:

```typescript
// Ephemeral — NOT persisted on DatabaseView
sessionFilter?: VisualFilterModel;

// At prepare time:
effectiveQuery = mergeQueryWithVisualFilter(view.query, sessionFilter);
filterNotes(notes, service, effectiveQuery, { formulaColumns });
```

**Reject** persisting temporary filters on `DatabaseView` — blurs saved view semantics.

**Reject** a second gallery/table filter engine — overlay compiles to additional AND clauses on the same engine.

UI affordance: “Refine results” chip row above presentation; “Save as new view” promotes overlay → new `DatabaseView.query`.

---

## Deliverable 6 — UX Architecture Recommendation (Q8)

### Current debt

`DatabaseViewControls.tsx` (~750 lines) grows linearly per presentation. Table branch embeds rollup/formula authoring. Each presentation adds props, presets, and patch handlers.

### Verdict: **Hybrid refactor — unified shell, presentation-specific panels**

Keep:

- `DatabaseViewPanel` as unified shell (controls + renderer dispatch)
- `DatabasePresentationSwitcher` shared
- `prepareDatabaseViewPresentation` dispatch

Extract:

| Component | Responsibility |
| --------- | -------------- |
| `TableViewControls` | Sort (multi in K-18), columns, rollups, formulas |
| `BoardViewControls` | `groupBy` |
| `CalendarViewControls` | `dateProperty` |
| `TimelineViewControls` | start/end date properties |
| `GalleryViewControls` | cover + card fields |
| `DatabaseFilterControls` (K-18) | Visual builder + query string toggle — shared across entities |

`DatabaseViewControls` becomes a thin router:

```typescript
switch (presentation) {
  case 'table': return <TableViewControls ... />;
  case 'board': return <BoardViewControls ... />;
  // ...
}
```

**Do not** split `DatabaseViewPanel` into five workspace kinds. **Do not** duplicate filter UI per presentation — filters apply to `view.query`, not presentation config.

**Severity:** Medium — refactor before adding multi-sort UI + visual builder or controls will become unmaintainable.

---

## Deliverable 7 — Template Preparation Recommendation (Q9)

### Verdict: **Template factory module — no new persisted entity**

```typescript
interface DatabaseTemplate {
  id: string;
  name: string;
  description: string;
  category: 'study' | 'reading' | 'project' | 'language';
  createView: () => DatabaseView;                    // query + presentationConfig preset
  optionalRuleCollection?: () => RuleCollection;   // optional bundled rule
}
```

Examples:

| Template | query | presentation | presentationConfig highlights |
| -------- | ----- | ------------ | ----------------------------- |
| Study Tracker | `tag:study` | board | `groupBy: status` |
| Reading Tracker | `tag:reading` | gallery | `coverProperty: coverImage`, cardFields |
| Project Tracker | `tag:project` | timeline | start/end date properties |
| Language Learning | `tag:japanese` | table | columns + formula column preset |

### Interaction with K-18 features

| Feature | Template strategy |
| ------- | ----------------- |
| **Filters** | Templates ship pre-built `query` strings; visual builder edits after creation |
| **Sorting** | Templates may set `sortRules` on table configs |
| **Presentations** | Templates choose `presentation` + `presentationConfig` defaults |
| **Formulas / rollups** | Templates embed `formulaColumns` / `rollupColumns` in table config cache |

Templates invoke existing `createDatabaseView()` — no template-specific persistence schema.

Workspace: optional “Create from template” activates resulting view via `{ kind: 'database-view', id }`.

---

## Deliverable 8 — Technical Debt Assessment (Q10)

| Debt area | Description | Severity | K-18 action |
| --------- | ----------- | -------- | ----------- |
| **Sorting** | Single rule; no rollup/formula sort keys; timeline isolated sort | **Medium** | Add `sortRules`; extend `getDatabaseRowSortValue` in K-18.5 |
| **Filter authoring** | Raw query string only; error-prone for formulas/relations | **Medium** | Visual builder compiles to query |
| **Query coupling** | Formula catalog merge for global search | **Low** | Documented; acceptable |
| **Controls monolith** | `DatabaseViewControls` linear growth | **Medium–High** | Extract per-presentation panels before K-18 UI |
| **Dual type drift** | Timeline/gallery types in runtime + future models | **Low** | Consolidate when extending configs |
| **updateViewTable guard** | Column mutators force table-shaped config | **Low** | Guard programmatic API when on non-table presentations |
| **AND-only queries** | No OR/NOT/grouping | **Low (known)** | Defer; document in visual builder scope |
| **Gallery/board ordering** | Filter iteration order only | **Low** | Optional default sort when switching from table |

---

## Deliverable 9 — Migration Strategy

### Phase K-18.1 — Multi-sort (table)

1. Add `sortRules?: DatabaseViewSortRule[]` to `DatabaseTableConfig` (types only → normalization → sort function).
2. `normalizeDatabaseViews`: migrate `sort` → `sortRules`; sync `sort = sortRules[0]`.
3. Update `sortDatabaseViewRows` to accept rule list.
4. Table controls: multi-row sort UI.
5. Tests: legacy persistence, switch presentation, lexicographic ordering.

### Phase K-18.2 — Visual filter builder

1. Ship `VisualFilterModel` UI (architecture types already scaffolded).
2. Authoring modes: visual ↔ raw query string toggle on Database View / Saved View / Rule Collection forms.
3. Compile via `compileVisualFilterToQueryString`; validate with `parseQuery`.
4. Session overlay via `mergeQueryWithVisualFilter` in `DatabaseViewPanel` (not persisted).
5. Tests: compilation round-trip, formula/relation/tag rows, merge with base query.

### Phase K-18.3 — Controls refactor

1. Extract presentation control subcomponents.
2. Add shared `DatabaseFilterControls`.
3. No behavior change — pure refactor PR.

### Phase K-18.4 — Templates

1. `databaseTemplates.ts` factory module.
2. “New from template” in `DatabaseViewsSection`.
3. Templates produce views through existing CRUD + storage.

### Rollback safety

All phases are additive. Legacy clients reading `sort` and `query` continue to work. Visual builder output is plain query strings — no migration of stored data required.

---

## Question-by-Question Verdicts

| # | Question | Verdict |
| - | -------- | ------- |
| Q1 | Multi-sort | `sortRules[]` on table config; lexicographic `sortDatabaseViewRows` |
| Q2 | Visual filters A or B | **A — compile to query strings** |
| Q3 | Same query engine? | **Yes** for all string-based consumers; Smart Collections stay separate |
| Q4 | FilterCondition → ParsedQuery? | **Yes** — 1:1 clause mapping, no redesign |
| Q5 | Formula/rollup/property exposure | Properties/tags/relations/formulas in builder; rollups deferred |
| Q6 | Database local filters | **Persisted query + session overlay** merged at prepare time |
| Q7 | Sort persistence | `sortRules` additive; `sort` shorthand for `[0]` |
| Q8 | Controls architecture | **Unified shell + extracted presentation panels** |
| Q9 | Templates | **Factory module** → `createDatabaseView()` |
| Q10 | Technical debt | Controls monolith and sort/filter authoring are primary risks |

---

## Optional Scaffolding (K-18.0 — no runtime wiring)

| Module | Contents |
| ------ | -------- |
| `query/visualFilterModels.ts` | `FilterCondition`, `FilterGroup`, `VisualFilterModel`, compile + merge helpers |
| `databaseViews/databaseSortFutureModels.ts` | `normalizeDatabaseViewSortRules`, `migrateLegacySortToSortRules` |
| Tests | `visualFilterModels.test.ts`, `databaseSortFutureModels.test.ts` |

No changes to `filterNotes`, `DatabaseViewControls` behavior, or persisted view shape in this milestone.

---

## Success Criteria Met

- Clear architecture for multi-sort, visual filters, and templates
- Query Engine remains single source of truth
- Database and workspace architecture remain coherent
- No behavior changes, no UI changes
- Validation: typecheck / test / build unchanged
