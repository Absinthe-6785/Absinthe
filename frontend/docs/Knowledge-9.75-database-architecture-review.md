# Knowledge-9.75 — Database Architecture Review

## Scope

Analysis-only architecture milestone for the Database Layer. Validates that the current `DatabaseView` model can support Board Views (K-10) and Calendar Views (K-11) without redesign. **No user-facing functionality, no behavior changes, no UI changes.**

Evidence base: K-9 (Database Views Foundation), K-9.5 (Database View Operations), K-8.75 (Workspace Architecture Review), and current `NoteView` integration.

---

## 1. Architecture Report

### Current layering

```
KnowledgeIndexService (properties, tags, metadata indexes)
        ↓
Query Engine: parseQuery → evaluateQuery → filterNotes
        ↓
DatabaseView { id, name, query, presentation, columns, sort }
        ↓
prepareDatabaseViewRows: filterByDatabaseView → sortDatabaseViewRows
        ↓
DatabaseTableView + DatabaseViewControls
        ↓
WorkspaceActivation { kind: 'database-view', id }
```

**Strengths**

- Single note-selection path: all database views resolve rows exclusively through `filterNotes(view.query)`
- Property-backed columns already read from `KnowledgeIndexService.getProperties()` and `getProperty()`
- `WorkspaceActivation` treats database views as first-class workspace entities
- Persistence is additive with backward-compatible normalization (K-9.5)
- Presentation enum already includes `'board' | 'calendar'` as forward placeholders

**Weaknesses**

- Table-specific config (`columns`, `sort`) lives on the root `DatabaseView` record rather than a presentation-scoped config object
- `prepareDatabaseViewRows()` always applies table sort — board/calendar would need their own post-filter transforms
- `normalizeDatabaseViews()` only accepts `presentation: 'table'` as supported
- `NoteView` renders table controls unconditionally when `isDatabaseViewMode` — no presentation dispatch yet
- Cell value resolution (`getDatabaseCellValue`) lives in `DatabaseTableView.tsx` — should be shared for board cards and calendar entries

**Scaling concerns**

- Board grouping by property value requires O(n) scan over filtered notes unless a property-value index bucket is reused (`getNotesWithProperty` is per-value, not per-key enumeration)
- Calendar date parsing from string properties has no typed date index today — grouping is computed at render time from filtered notes
- As presentation types grow, root-level field accumulation (`columns`, `sort`, future `groupBy`, `dateProperty`) becomes unmaintainable

**Future integration concerns**

- Switching presentation (table → board) should not require a new workspace entity or activation model
- Board drag-and-drop property updates (future) must write through existing Properties API, not a new store
- Calendar views need a date interpretation policy for string properties (ISO, locale, or note `updatedAt` fallback)

---

## 2. Current Database Model

### Entity (K-9.5)

```typescript
interface DatabaseView {
  id: string;
  name: string;
  query: string;                              // knowledge query — never stores note ids
  presentation: 'table' | 'board' | 'calendar';
  columns?: DatabaseViewColumnEntry[];        // { key, visible } — table-specific today
  sort?: DatabaseViewSort;                    // { key, direction } — table-specific today
}
```

### Persistence

| Key | Format |
| --- | ------ |
| `note-database-views-v1` | `DatabaseView[]` JSON |

Normalization on load: invalid entries dropped; missing `columns`/`sort` receive table defaults; unsupported `presentation` coerced to `'table'`.

### Row pipeline (table)

```
filterByDatabaseView(notes, service, view)   // view.query → filterNotes
        ↓
sortDatabaseViewRows(notes, view.sort, service)
        ↓
resolveVisibleColumns(view.columns)
        ↓
DatabaseTableView
```

### Workspace integration

| Concern | Implementation |
| ------- | -------------- |
| Activation | `WorkspaceActivation { kind: 'database-view', id }` |
| Filter source | `WorkspaceFilterSource: 'query-rule'` |
| Sidebar | `DatabaseViewsSection` — CRUD + activate |
| Counts | `evaluateDatabaseView` → `filterNotes` length |

`resolveWorkspaceFilter()` does not apply database view filtering to the note list — database views replace the list panel with table UI. This separation remains valid for board/calendar (replace panel with board/calendar component).

---

## 3. Recommended Database Model

### Recommendation: **Option A** — unified `DatabaseView` with discriminated `presentationConfig`

```typescript
interface DatabaseView {
  id: string;
  name: string;
  query: string;
  presentation: DatabaseViewPresentation;
  presentationConfig: DatabasePresentationConfig;
}

type DatabasePresentationConfig =
  | DatabaseTableConfig
  | DatabaseBoardConfig
  | DatabaseCalendarConfig;
```

**Reject Option B** (separate `TableView`, `BoardView`, `CalendarView` models):

| | Option A (unified) | Option B (separate) |
| --- | --- | --- |
| Workspace activation | One `database-view` kind, one id | Three kinds or id namespace split |
| Persistence | One array, one key | Three keys or polymorphic union with duplicated query |
| Sidebar UX | One "Database Views" section | Fragmented or merged with adapter layer |
| Query reuse | Single `filterByDatabaseView(view)` | Must duplicate or wrap shared query field |
| Migration | Additive: lift `columns`/`sort` into `presentationConfig.table` | Breaking: split existing records |

Option B adds adapter complexity without benefit — presentation differs in **rendering and post-filter grouping**, not in **note selection**.

### Recommended presentation configs

```typescript
// Table (K-9.5 — lift existing fields)
interface DatabaseTableConfig {
  type: 'table';
  columns: DatabaseViewColumnEntry[];
  sort: DatabaseViewSort;
}

// Board (K-10)
interface DatabaseBoardConfig {
  type: 'board';
  groupBy: string;           // property key, e.g. "status"
  lanes?: string[];            // optional fixed order: ["Todo", "Doing", "Done"]
  cardFields?: string[];       // property keys shown on cards; default ["title"]
}

// Calendar (K-11)
interface DatabaseCalendarConfig {
  type: 'calendar';
  dateProperty: string;        // property key, e.g. "dueDate"; or "updatedAt"
  unscheduledLabel?: string;   // bucket for notes without parseable dates
}
```

### Backward compatibility migration (K-10 prep)

On normalize:

1. If `presentationConfig` absent but `columns`/`sort` present → `{ type: 'table', columns, sort }`
2. If neither present → table defaults
3. Keep reading root-level `columns`/`sort` through K-10; write both during transition optional

No storage key change required for K-10/K-11.

---

## 4. Review Question Answers

### Q1 — Can `DatabaseView` remain the core model for table, board, calendar?

**Yes.** The shared core is `{ id, name, query, presentation }`. Presentation-specific behavior belongs in `presentationConfig` and presentation-specific renderers. No redesign required — an additive refactor of table fields into `presentationConfig.table`.

### Q2 — Where should presentation-specific configuration live?

**On `DatabaseView` via discriminated `presentationConfig`** (Option A).

Presentation config must **not** be a separate persisted entity — users think in terms of one "Japanese Study database" that can switch presentation, not three linked records.

### Q3 — Can `WorkspaceActivation` support database views without modification?

**Yes.** Activation identifies *which* database view is active (`{ kind: 'database-view', id }`). Presentation mode is a property of the view record, not activation state. Switching table → board within the same view requires editing the view, not a new activation kind.

Optional future: `WorkspaceItemRef.subtitle` can show `"tag:japanese · board"` for sidebar tooltips — no activation change.

### Q4 — Can persistence remain `note-database-views-v1`?

**Yes, with additive schema evolution inside the JSON array.**

| Approach | Verdict |
| -------- | ------- |
| Keep `note-database-views-v1` | ✅ Recommended — normalize handles legacy shapes |
| New `note-database-views-v2` key | ❌ Unnecessary until a breaking schema change (e.g. splitting entities) |
| Version field per record | ⚠️ Optional later if normalization becomes complex |

K-10/K-11 add fields to existing records; normalization lifts legacy `columns`/`sort` into `presentationConfig`.

### Q5 — Can Query Engine remain the single source of note selection?

**Yes.**

All presentations share:

```
DatabaseView.query → filterNotes(notes, service, query) → NoteBase[]
```

Board grouping and calendar bucketing operate on the **filtered note set** using property values from `KnowledgeIndexService` / Properties API. Query semantics must never depend on presentation mode.

**Justification:** `filterByDatabaseView` already ignores `columns`, `sort`, and `presentation`. K-9.5 sorting is explicitly post-filter. Board lanes and calendar dates are also post-filter transforms — same pattern.

### Q6 — Technical debt today

| Item | Severity | Notes | Timing |
| ---- | -------- | ----- | ------ |
| Table fields on root model (`columns`, `sort`) | Medium | Blocks clean presentation dispatch | Lift to `presentationConfig` in K-10 prep |
| `prepareDatabaseViewRows` name/table-assumption | Medium | Board/calendar need `prepareDatabaseViewData(view, notes, service)` | K-10 |
| `getDatabaseCellValue` in table component | Low | Extract to `databaseFieldValues.ts` for reuse on cards | K-10 |
| `normalizeDatabaseViews` rejects non-table presentation | Low | Intentional gate until K-10/K-11 | K-10/K-11 |
| `NoteView` table-only database panel | Medium | Needs `renderDatabasePresentation(view, rows)` dispatch | K-10 |
| `DatabaseViewControls` table-only | Medium | Split per presentation or conditional sections | K-10/K-11 |
| No property-key enumeration API | Low | Board lane discovery scans filtered notes O(n) — acceptable for K-10 | Monitor |
| String property dates for calendar | Medium | Need `parseDatabaseDate(value)` utility with explicit format policy | K-11 |
| Duplicated query validation with rule collections | Low | Pre-existing workspace debt | K-10+ optional |

**No critical debt.** Architecture is sound; debt is table-centric naming and field placement, not fundamental design flaws.

---

## 5. Board View Integration Plan (Knowledge-10)

### Requirements

```typescript
// Example board config
{
  type: 'board',
  groupBy: 'status',
  lanes: ['Todo', 'Doing', 'Done'],  // optional — else derive from distinct values
  cardFields: ['title', 'priority']
}
```

### Property system fit

**Yes — fully representable with existing properties.**

| Board concept | Property system mapping |
| ------------- | ---------------------- |
| Lane column (`Todo`, `Doing`, `Done`) | `getProperty(note, groupBy)` → string value |
| Grouping | Bucket filtered notes by normalized property value |
| Card title | Built-in `title` or `getProperty` |
| Card metadata | Additional property keys in `cardFields` |
| Query scope | Unchanged — `tag:japanese status:active` pre-filters rows |

Lane discovery without fixed `lanes`:

1. Filter notes via `filterNotes`
2. For each note, read `getProperty(note, groupBy)` via service
3. Collect distinct values → lane headers
4. Notes with missing/empty property → `"No status"` lane

Index optimization (optional later): iterate `getPropertyValues(groupBy)` if added to `KnowledgeIndexService` — not required for K-10 foundation.

### K-10 pipeline

```
DatabaseView (presentation: 'board')
        ↓
filterByDatabaseView → NoteBase[]
        ↓
groupNotesByProperty(notes, groupBy, service) → Map<lane, NoteBase[]>
        ↓
DatabaseBoardView (lanes, cards)
```

### K-10 UI (not implemented here)

- Replace `DatabaseTableView` + `DatabaseViewControls` with board dispatch when `presentation === 'board'`
- Lane columns rendered horizontally
- Card click → `setActiveNoteId` (same as table row click)
- Config UI: pick `groupBy` property key, optional lane order

### Out of scope for K-10 foundation

- Drag-and-drop lane changes (property writes)
- WIP limits, swimlanes, sub-groups

---

## 6. Calendar View Integration Plan (Knowledge-11)

### Requirements

```typescript
// Example calendar config
{
  type: 'calendar',
  dateProperty: 'dueDate',   // or 'updatedAt' (builtin)
}
```

### Property system fit

**Yes — with a string-to-date parsing policy.**

| Calendar concept | Mapping |
| ---------------- | ------- |
| Event date | `getProperty(note, dateProperty)` parsed to `Date` |
| Fallback builtin | `dateProperty: 'updatedAt'` uses `note.updatedAt` |
| Unscheduled | Notes with missing/unparseable dates |
| Query scope | Unchanged — query pre-filters note set |

Property values are strings today. K-11 must define:

```typescript
parseDatabaseDate(value: string): Date | null
// Policy: ISO 8601 first (2024-06-09, 2024-06-09T12:00:00)
// Fallback: Date.parse with explicit invalid handling
```

No date index exists — calendar bucketing scans filtered notes O(n), same as board grouping. Acceptable for K-11 foundation.

### K-11 pipeline

```
DatabaseView (presentation: 'calendar')
        ↓
filterByDatabaseView → NoteBase[]
        ↓
bucketNotesByDate(notes, dateProperty, service) → Map<dateKey, NoteBase[]>
        ↓
DatabaseCalendarView (month grid or list-by-day)
```

### K-11 UI (not implemented here)

- Month/week grid with note chips per day
- "Unscheduled" sidebar section
- Config UI: pick `dateProperty` key

### Out of scope for K-11 foundation

- Recurring events, time-of-day slots, drag-to-reschedule

---

## 7. Workspace Review

Current workspace architecture **remains valid** for board and calendar.

| Workspace type | K-9.75 status |
| -------------- | ------------- |
| `WorkspaceActivation` | ✅ No change — `{ kind: 'database-view', id }` |
| `WorkspaceFilterSource` | ✅ `'query-rule'` — presentation-agnostic |
| `WorkspaceItemRef` | ✅ Extend subtitle to include presentation label |
| `resolveWorkspaceFilter()` | ✅ Database views stay outside list filter path |
| `activateDatabaseViewWorkspace()` | ✅ No change |

Database views remain distinct from rule collections: same query resolution, different **presentation shell** (table / board / calendar vs note list).

---

## 8. Migration Strategy

### Phase 0 — K-9.75 (this milestone)

- Publish this architecture document
- Add forward-looking `databasePresentationModels.ts` types (documentation-first)
- **No runtime behavior changes**

### Phase 1 — K-10 prep (small refactor)

1. Introduce `presentationConfig` on `DatabaseView` with table config shape
2. Normalize: lift root `columns`/`sort` → `presentationConfig.table`
3. Extract `getDatabaseFieldValue(note, key, service)` shared module
4. Rename/generalize `prepareDatabaseViewRows` → `prepareDatabaseViewNotes` (filter only) + presentation-specific transforms

### Phase 2 — K-10 Board Views

1. Add `DatabaseBoardConfig` + `groupNotesByProperty()`
2. Extend normalize to accept `presentation: 'board'`
3. Add `DatabaseBoardView` component
4. NoteView presentation dispatch: `table | board | calendar`

### Phase 3 — K-11 Calendar Views

1. Add `DatabaseCalendarConfig` + `parseDatabaseDate()` + `bucketNotesByDate()`
2. Add `DatabaseCalendarView` component
3. Extend normalize to accept `presentation: 'calendar'`

**Backward compatibility:** All phases additive. Existing table views continue working via normalization shim.

---

## 9. Option Evaluation Summary

| Criterion | Option A (unified + presentationConfig) | Option B (separate models) |
| --------- | ---------------------------------------- | -------------------------- |
| Workspace fit | ✅ Single activation kind | ❌ Multiple kinds or adapters |
| Persistence | ✅ One key, one array | ❌ Duplicated query storage |
| Query reuse | ✅ Natural | ⚠️ Requires shared base type anyway |
| Migration | ✅ Lift columns/sort | ❌ Split existing records |
| Type safety | ✅ Discriminated union on presentation | ⚠️ Three parallel CRUD modules |

**Recommendation: Option A.**

---

## Summary

| Question | Answer |
| -------- | ------ |
| Core model for all presentations? | **Yes** — `DatabaseView` + `presentationConfig` |
| Config location? | **On DatabaseView** — discriminated by presentation |
| WorkspaceActivation changes? | **No** |
| Persistence key? | **Keep `note-database-views-v1`** — additive schema |
| Query Engine single source? | **Yes** — all presentations filter via `filterNotes` |
| Board via properties? | **Yes** — `groupBy` property key |
| Calendar via properties? | **Yes** — `dateProperty` with parse policy |
| Recommended option | **Option A** |

DatabaseView can evolve to Board and Calendar presentations **without redesign**. K-10/K-11 add presentation config shapes, post-filter grouping utilities, and render components — not new selection engines.

---

## Validation

This milestone introduces documentation and forward-looking type definitions only.

Expected: `npm run typecheck` PASS · `npm test` PASS · `npm run build` PASS · no behavior changes · no UI changes.
