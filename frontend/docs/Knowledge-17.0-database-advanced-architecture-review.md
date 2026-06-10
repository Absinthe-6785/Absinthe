# Knowledge-17.0 — Database Advanced Architecture Review

## Scope

Architecture-only milestone. Evaluates the future evolution of the Database Layer — Timeline, Gallery, advanced filters, multi-sort, grouped tables, and templates — before implementation. **No user-facing features, no behavior changes, no UI changes.**

Evidence base: Database Layer (K-9–K-11.5), Rollups (K-15), Formulas (K-16/K-16.5), Query Engine (K-7/K-16.5), Workspace (K-8.75).

---

## Pre-Implementation Architecture Report

### Current state (post K-16.5)

```
DatabaseView { id, name, query, presentation, presentationConfig }
        ↓
filterByDatabaseView → filterNotes (tag/property/relation/formula)
        ↓
prepareDatabaseViewPresentation (dispatch)
  table    → prepareDatabaseViewRows → sort → DatabaseTableView
  board    → prepareDatabaseBoardLanes → DatabaseBoardView
  calendar → prepareDatabaseCalendarBuckets → DatabaseCalendarView
        ↓
DatabaseViewPanel (controls + renderer)
        ↓
WorkspaceActivation { kind: 'database-view', id }
```

| Capability | Status |
| ---------- | ------ |
| Table + columns/sort/rollup/formula | ✅ |
| Board (groupBy lanes) | ✅ |
| Calendar (dateProperty buckets) | ✅ |
| Unified presentation dispatch | ✅ `prepareDatabaseViewPresentation` |
| Shared note cards | ✅ `DatabaseNoteCard` |
| Shared field resolution | ✅ `getDatabaseFieldValue` |
| Formula queries in view.query | ✅ K-16.5 |
| Timeline / Gallery | ❌ Not implemented |
| Visual filter builder | ❌ Not implemented |
| Multi-column sort | ❌ Single sort rule |
| Grouped table sections | ❌ Not implemented |
| Database templates | ❌ Not implemented |

### Validated layering (unchanged)

Database views are **query-scoped presentation** over note sets. Selection semantics live in the Query Engine; transforms live in presentation prepare pipelines; rendering lives in presentation components. Rollups and formulas are computed presentation values (K-15/K-16), not stored on notes.

---

## 1. Can Current Architecture Support Table / Board / Calendar / Timeline / Gallery?

### Verdict: **Yes — without redesign**

K-9.75 validated board and calendar via discriminated `presentationConfig`. K-10/K-11 confirmed the pattern. Timeline and Gallery follow the same extension model:

| Presentation | Config discriminant | Post-filter transform | Renderer |
| ------------ | ------------------- | --------------------- | -------- |
| Table | `type: 'table'` | sort rows | `DatabaseTableView` |
| Board | `type: 'board'` | group by property → lanes | `DatabaseBoardView` |
| Calendar | `type: 'calendar'` | bucket by date | `DatabaseCalendarView` |
| **Timeline** | `type: 'timeline'` | sort/bucket by date range | `DatabaseTimelineView` (K-17.5+) |
| **Gallery** | `type: 'gallery'` | card list (optional cover) | `DatabaseGalleryView` (K-17.5+) |

**No change to:** `DatabaseView` core shape, `filterByDatabaseView`, `WorkspaceActivation`, or Query Engine selection semantics.

**Additive changes only:** extend `DatabaseViewPresentation` union, add config interfaces, add prepare + render branches.

---

## 2. Database Presentation Model Recommendation

### Option analysis

| Option | Description | Verdict |
| ------ | ----------- | ------- |
| **A — Keep current unified model** | Single `DatabaseView` + discriminated `presentationConfig` | ✅ **Recommended** |
| **B — Separate view entities** | `TableView`, `BoardView`, … as distinct types | ❌ Fragments workspace model |
| **C — Hybrid** | Unified entity + presentation-specific config | ✅ **Same as A** — already implemented |

### Recommendation: **Option A / C — Unified `DatabaseView` with discriminated `presentationConfig`**

```typescript
interface DatabaseView {
  id: string;
  name: string;
  query: string;                    // selection — never stores note ids
  presentation: DatabaseViewPresentation;
  presentationConfig: DatabasePresentationConfig;
}
```

**Justification:**

- K-9.75 through K-11.5 proved presentation switching preserves cached configs (table columns retained when switching to board)
- Workspace activation references one entity kind: `{ kind: 'database-view', id }`
- Query, formula catalog, and sidebar counts are presentation-agnostic
- Separate entities (Option B) would duplicate CRUD, persistence, workspace wiring, and formula catalog merge logic

**Reject Option B:** N presentation types × shared concerns (query, persistence, activation) = unmaintainable duplication without user benefit.

---

## 3. Timeline Integration Plan

### Config shape

```typescript
interface DatabaseTimelineConfig {
  type: 'timeline';
  /** Start of range — property key or built-in metadata */
  startDateProperty: string;
  /** Optional end — single-day events omit */
  endDateProperty?: string;
  /** Sort within timeline: 'start' | 'end' | 'title' */
  sortBy?: 'start' | 'end' | 'title';
  unscheduledLabel?: string;
}
```

### Pipeline

```
filterByDatabaseView(view)
        ↓
prepareDatabaseTimelineEntries(view, notes, service)
  → getNoteDateValue(note, startDateProperty)
  → optional end date from endDateProperty
  → sort by start ascending
        ↓
DatabaseTimelineView (horizontal/vertical bar — K-17.5 UI)
```

### Fit with existing architecture

| Concern | Reuse |
| ------- | ----- |
| Date parsing | ✅ `getNoteDateValue`, `parseDatabaseDate` (calendar) |
| Unscheduled bucket | ✅ Same policy as calendar `NO_DATE_KEY` |
| Prepare dispatch | ✅ Add case to `prepareDatabaseViewPresentation` |
| Controls | ✅ Extend `DatabaseViewControls` with `DatabasePropertyKeyField` for date keys |

**No redesign required.** Timeline is calendar's sibling — range-oriented instead of month-grid-oriented.

---

## 4. Gallery Integration Plan

### Config shape

```typescript
interface DatabaseGalleryConfig {
  type: 'gallery';
  /** Property key for cover image URL or attachment ref — optional */
  coverProperty?: string;
  /** Fields on cards — same pattern as board cardFields */
  cardFields?: string[];
  /** Optional card size preset */
  cardSize?: 'compact' | 'medium' | 'large';
}
```

### Pipeline

```
filterByDatabaseView(view)
        ↓
prepareDatabaseGalleryCards(view, notes, service)
  → resolve cover via getDatabaseFieldValue(note, coverProperty)
  → resolve cardFields
        ↓
DatabaseGalleryView (CSS grid — K-17.5 UI)
```

### Integration requirements

| Requirement | Approach |
| ----------- | -------- |
| Card rendering | Reuse `DatabaseNoteCard` + optional cover slot |
| Field resolution | Reuse `getDatabaseFieldValue` |
| Empty state | Reuse `DATABASE_EMPTY_MESSAGE` |
| Sort order | Inherit table sort when switching from table, or default `updatedAt desc` on gallery config (K-17.5 decision) |

Gallery is structurally closest to **board without lanes** — a flat card grid over filtered notes.

---

## 5. Advanced Filter Strategy

### Future examples

```
Status = Active
Priority = High
Progress > 80
```

### Recommendation: **Compile to query strings — single Query Engine**

| Approach | Verdict |
| -------- | ------- |
| **A — Visual builder → query string** | ✅ **Recommended** |
| **B — Parallel filter AST / second system** | ❌ Reject |

**Justification:**

- K-16.5 established formula predicates as query clauses — visual filters must compose with `tag:`, `relation:`, `formula:`
- AND semantics already defined; visual builder emits `ParsedQuery` or canonical query string
- Saved views, rule collections, and database views all store `query: string` — visual builder is an **authoring UI**, not a new runtime
- Example compilation: `Status = Active` → `status:Active`; `Progress > 80` → `formula:progress>80`

**Implementation (K-18+):**

```
VisualFilterBuilder → ParsedQuery → formatParsedQuery() → view.query
```

No second filtering system. `filterNotes` remains the single evaluation path.

---

## 6. Advanced Sorting Strategy

### Current

```typescript
interface DatabaseViewSort {
  key: string;
  direction: 'asc' | 'desc';
}
```

Single rule on `DatabaseTableConfig.sort`.

### Future: multi-column sort

```typescript
type DatabaseViewSortRule = DatabaseViewSort;
// DatabaseTableConfig.sortRules?: DatabaseViewSortRule[]  // K-17.5+
```

Example: `status asc`, `priority desc`, `updatedAt desc`

### Architecture impact

| Area | Change |
| ---- | ------ |
| `sortDatabaseViewRows` | Accept ordered rule list; compare lexicographically |
| `DatabaseViewControls` | Multi-row sort editor |
| Board / calendar / timeline | Optional — table-primary feature |
| Persistence | Additive field; migrate single `sort` → `[sort]` |

**Severity:** Low — localized to table prepare pipeline. No Query Engine or workspace changes.

**Backward compatibility:** Keep `sort` as shorthand for `sortRules[0]` when `sortRules` absent.

---

## 7. Grouped Tables Recommendation

### Example

```
Status
  Todo
  Doing
  Done
```

### Option analysis

| Option | Verdict |
| ------ | ------- |
| **Table enhancement** (section headers within table) | ⚠️ Optional K-18+ |
| **Board variant** | ✅ **Recommended for status/property grouping today** |
| **New presentation type** | ❌ Unnecessary — board already groups by property |

### Recommendation

- **Property-based grouping (Status, Priority):** Use **Board View** — implemented, lanes derive from `groupBy`
- **Collapsible section headers in table:** Table enhancement (`groupBy` + `showGroupHeaders` on `DatabaseTableConfig`) — defer until user demand; not a new presentation type

Grouped table and board share the same data transform (`groupNotesByProperty`). A grouped table is board semantics rendered as horizontal sections instead of vertical lanes.

---

## 8. Template Architecture Recommendation

### Potential templates

Study Tracker · Reading Tracker · Project Tracker · Language Learning Tracker

### Option analysis

| Option | Verdict |
| ------ | ------- |
| **Database Layer** | ❌ Templates are not a presentation concern |
| **Workspace Layer** | ⚠️ Partial — activation bundles |
| **Separate Template System** | ✅ **Recommended** |

### Recommendation: **Template factory module (K-18+)**

```typescript
interface DatabaseTemplate {
  id: string;
  name: string;
  description: string;
  create: () => DatabaseView;           // pre-built query + presentationConfig
  optionalRuleCollection?: RuleCollection;
}
```

Templates produce **factory presets** — a `DatabaseView` (and optionally a rule collection) inserted via existing CRUD. No new persisted entity type.

| Layer | Role |
| ----- | ---- |
| **Template System** | Curated presets, onboarding |
| **Database Layer** | Stores resulting `DatabaseView` |
| **Workspace Layer** | Optional bundled activation |

**Reject embedding templates in DatabaseView schema** — templates are authoring-time, not runtime state.

---

## 9. Formula / Rollup Future in Timeline and Gallery

### Current

| Feature | Table | Board | Calendar |
| ------- | ----- | ----- | -------- |
| Rollup columns | ✅ | ❌ (Phase 2 badges) | ❌ (Phase 2 subtitle) |
| Formula columns | ✅ | ❌ (Phase 2 badges) | ❌ (Phase 2 subtitle) |

### Future abstraction

Shared **computed field resolver** (optional K-17.5 refactor):

```typescript
getDatabaseComputedValue(note, column, service, notesById)
  → rollup | formula | property
```

| View | Rollup/Formula display |
| ---- | ---------------------- |
| **Timeline** | Bar label / tooltip badges via `cardFields`-like config |
| **Gallery** | Card footer fields — same as `cardFields` + optional `cardRollups` / `cardFormulas` on config |

**Direction:** Extend board/gallery/calendar configs with optional `cardRollups?: RollupColumnDefinition[]` and `cardFormulas?: FormulaColumnDefinition[]` — parallel to K-15/K-16 table columns. No new compute engine.

**Timeline-specific:** Rollups suit duration/count labels (e.g. task count on project bar). Formulas suit progress percentages on bars.

**No redesign** — additive optional fields on presentation configs.

---

## 10. Workspace Impact

### Question: New workspace kinds for Timeline/Gallery?

### Recommendation: **Continue `{ kind: 'database-view', id }`**

| Concern | Answer |
| ------- | ------ |
| New `WorkspaceItemKind` per presentation? | ❌ No |
| Presentation stored on `DatabaseView.presentation` | ✅ Yes |
| Sidebar counts | ✅ `evaluateDatabaseView` — presentation-agnostic |
| Activation | ✅ Unchanged |

Timeline and Gallery are **presentation modes of an existing database view**, same as switching table → board today. Workspace references the view entity, not the renderer.

---

## 11. Technical Debt Assessment

| Item | Severity | Notes |
| ---- | -------- | ----- |
| **DatabaseViewPanel / Controls size** | Medium | ~650 lines; grows with each presentation's config UI — extract per-presentation control sections (K-17.5) |
| **Presentation dispatch** | Low | Consolidated in K-11.5 via `prepareDatabaseViewPresentation` — extend with new cases |
| **Table-only rollup/formula UX** | Medium | Rollup/formula authoring only in table branch of controls — extract shared "computed columns" panel |
| **Single-column sort** | Low | Adequate for Phase 1; multi-sort is additive |
| **Sort excludes rollup/formula columns** | Medium | Documented Phase 2 in K-15/K-16 — requires computed sort values |
| **NoteView database wiring** | Low | Delegated to `DatabaseViewPanel` since K-11.5 |
| **Duplicated date handling** | Low | Calendar + future timeline share `getNoteDateValue` — sufficient |
| **Formula catalog from views** | Low | K-16.5 `buildFormulaQueryCatalog` — scales with view count; acceptable |

**Highest priority pre-Timeline/Gallery:** Extract presentation-specific control subcomponents from `DatabaseViewControls` to limit panel growth.

---

## 12. Migration Strategy

### Phase 0 — K-17.0 (this milestone)

- Publish architecture document
- Add forward-looking `databasePresentationFutureModels.ts` types
- **No runtime behavior changes**

### Phase 1 — K-17.5 Timeline Foundation

1. `DatabaseTimelineConfig` + `prepareDatabaseTimelineEntries`
2. `DatabaseTimelineView` renderer
3. Presentation switcher + controls extension
4. Tests: date range, unscheduled, query integration

### Phase 2 — K-17.75 Gallery Foundation

1. `DatabaseGalleryConfig` + `prepareDatabaseGalleryCards`
2. `DatabaseGalleryView` grid renderer
3. Cover property + card fields

### Phase 3 — K-18 Advanced Sort + Filter UX

1. Multi-column `sortRules` on table config
2. Visual filter builder → query string compiler
3. Rollup/formula column sort (computed)

### Phase 4 — K-18.5 Database Templates

1. Template factory module
2. Onboarding presets (study, reading, project trackers)
3. Optional workspace bundle activation

**Backward compatibility:** All phases additive. Existing table/board/calendar views, queries, rollups, formulas, and workspace activation unchanged.

---

## Summary

| Question | Answer |
| -------- | ------ |
| Support Timeline/Gallery without redesign? | **Yes** — extend discriminated `presentationConfig` |
| Presentation model | **Option A/C** — unified `DatabaseView` |
| Timeline integration | `DatabaseTimelineConfig` + date prepare pipeline |
| Gallery integration | `DatabaseGalleryConfig` + card grid via `DatabaseNoteCard` |
| Advanced filters | **Compile to query strings** — no second filter system |
| Advanced sorting | **Multi-rule `sortRules`** on table config |
| Grouped tables | **Use Board** for grouping; optional table section headers later |
| Templates | **Separate template factory** — produces `DatabaseView` presets |
| Rollup/formula in new views | Optional `cardRollups` / `cardFormulas` on configs |
| Workspace impact | **Keep `{ kind: 'database-view' }`** |
| Top technical debt | Controls panel size; table-only computed column UX |

Database and Workspace architectures remain coherent. Timeline, Gallery, advanced filters, sorting, and templates extend the validated K-9.75 model without redesign.

---

## Validation

This milestone introduces documentation and forward-looking type definitions only.

Expected: `npm run typecheck` PASS · `npm test` PASS · `npm run build` PASS · no behavior changes · no UI changes.
