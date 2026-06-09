# Knowledge-8.75 — Workspace Architecture Review

## Scope

Analysis-only architecture milestone for the note workspace layer. **No user-facing functionality, no behavior changes, no UI changes, no runtime refactors beyond lightweight shared type definitions.**

Evidence base: K-7 (query engine), K-7.5 (saved views), K-8 (smart collections), K-8.5 (rule collections), and current `NoteView` sidebar integration.

---

## 1. Architecture Report

### Current layering

```
Knowledge Layer (KnowledgeIndexService)
  backlinks · properties · tags · mentions · related notes
        ↓
Retrieval Layer
  parseQuery → evaluateQuery → filterNotes
  saved views (query presets bound to search input)
        ↓
Workspace Layer
  smart collections (system index evaluators)
  rule collections (persistent query rules)
        ↓
NoteView shell
  folder/tag scope → workspace filter → search query → sort → note list
```

`KnowledgeIndexService` remains the single source of truth for all metadata-backed filtering. Workspace entities never store note IDs; results are always computed at read time.

### Overlap analysis

All three workspace entities share:

| Concern | Saved Views | Smart Collections | Rule Collections |
| ------- | ----------- | ----------------- | -------------- |
| Sidebar section | Views | Smart Collections | Collections |
| Activation highlight | `activeSavedViewId` | `activeSmartCollectionId` | `activeRuleCollectionId` |
| Mutual exclusion | Clears others on activate | Clears others on activate | Clears others on activate |
| Result count | Via `visibleNotes.length` | Precomputed vault counts | Precomputed vault counts |
| Filtering | Indirect via `searchQuery` | `filterBySmartCollection` | `filterByRuleCollection` → `filterNotes` |
| Persistence | localStorage | None (in-memory catalog) | localStorage |
| User CRUD | Create / rename / delete | None | Create / rename / delete |

The overlap is structural (sidebar, activation, counts, filtering pipeline) but **semantic roles differ intentionally**:

- **Saved View** — ephemeral retrieval preset; activation **writes the search box** and deactivates when the query is edited.
- **Smart Collection** — system discovery lens; activation uses **index-specific evaluators** with optional ordering semantics.
- **Rule Collection** — persistent workspace object; activation applies a **stored query rule** without coupling to the search box.

Merging these into one user-visible concept would regress the K-7.5 / K-8 / K-8.5 product distinctions.

---

## 2. Current Workspace Model

### Entity definitions

```typescript
// K-7.5 — Retrieval preset
interface SavedView {
  id: string;
  name: string;
  query: string;           // knowledge query string
}

// K-8 — System catalog entry
interface SmartCollection {
  id: SmartCollectionId;   // fixed enum
  name: string;
  description: string;
  // no query — evaluated by switch/case over indexes
}

// K-8.5 — Persistent workspace object
interface RuleCollection {
  id: string;
  name: string;
  query: string;           // knowledge query string
}
```

### Persistence

| Entity | Storage key | Format |
| ------ | ----------- | ------ |
| Saved Views | `note-saved-views-v1` | `SavedView[]` JSON |
| Rule Collections | `note-rule-collections-v1` | `RuleCollection[]` JSON |
| Smart Collections | — | `SMART_COLLECTIONS` constant |

Saved Views and Rule Collections share identical normalization shape (`id`, `name`, `query`) and validation (`isKnowledgeQuery` + `parseQuery`), but use **separate storage keys** and **separate CRUD modules** by design.

### Activation model (NoteView)

Three independent nullable state variables:

```
activeSavedViewId: string | null
activeSmartCollectionId: SmartCollectionId | null
activeRuleCollectionId: string | null
```

Each `handleActivate*` repeats the same clearing pattern:

1. `setActiveFolderId(null)`
2. `setActiveTag(null)`
3. Clear competing workspace IDs
4. Apply type-specific side effect

| Type | Side effect on activate |
| ---- | ----------------------- |
| Saved View | `setSearchQuery(view.query)` + `setActiveSavedViewId` |
| Smart Collection | `setSearchQuery('')` + `setActiveSmartCollectionId` |
| Rule Collection | `setSearchQuery('')` + `setActiveRuleCollectionId` |

Saved Views additionally sync: if `searchQuery` diverges from the active view's query, `activeSavedViewId` is cleared (`useEffect` at ```303:309:frontend/src/components/views/NoteView.tsx```).

### Filter pipeline (visibleNotes)

Order in ```433:485:frontend/src/components/views/NoteView.tsx```:

```
1. Folder scope (all / starred / folder / trash)
2. Tag filter (index: getNotesWithTag)
3. Smart collection (filterBySmartCollection → evaluateSmartCollection)
4. Rule collection (filterByRuleCollection → filterNotes)
5. Search query (filterNotes OR text/tag body search)
6. Sort (skipped when smart collection active — preserves collection ordering)
```

Rule collections and search queries can stack (collection narrows, then query narrows further). Smart collection activation clears search; saved view activation sets search (replacing prior filters' search coupling).

### Sidebar architecture

Three section components with duplicated shell:

| Component | CRUD | Counts | Create UX |
| --------- | ---- | ------ | --------- |
| `SmartCollectionsSection` | None | Yes | None |
| `RuleCollectionsSection` | Full | Yes | Name + query form, save current query |
| `SavedViewsSection` | Full | No | Name only, save current query |

Shared visual pattern: `bseclbl` header, optional clear (X), `bfi` rows, inline rename/delete for user entities.

**Duplication hotspots:**

- Section header + clear button (~15 lines × 3)
- Item row with active state (~20 lines × 3)
- Rename inline form (~15 lines × 2)
- Create form (~25 lines × 2)
- NoteView activation handlers (~8 lines × 3)
- NoteView mutual-exclusion clears in tag/folder/all-notes clicks

**Maintenance cost:** Low today (3 entities, stable). Will rise linearly with each new workspace section (Database Views adds a 4th activation path and likely a 4th sidebar block).

---

## 3. Recommended Workspace Model

### Principle: unified infrastructure, separate product types

Do **not** collapse Saved Views, Smart Collections, and Rule Collections into one user-facing list. Instead, introduce a **thin workspace infrastructure layer** that unifies activation, filtering dispatch, and (eventually) sidebar rendering — while keeping distinct entity types and storage boundaries.

### Recommended type hierarchy

See ```workspace/workspaceModels.ts``` for codified types:

```
WorkspaceItemKind     — discriminant for entity category
WorkspaceActivation   — single active workspace selection
WorkspaceFilterSource — how note IDs are resolved
WorkspaceItemRef      — minimal sidebar identity (id + kind + name)
```

**Key design choices:**

1. **One activation state** replaces three nullable IDs:

   ```typescript
   type WorkspaceActivation =
     | { kind: 'none' }
     | { kind: 'saved-view'; id: string }
     | { kind: 'smart-collection'; id: SmartCollectionId }
     | { kind: 'rule-collection'; id: string }
     | { kind: 'database-view'; id: string };  // future
   ```

2. **Filter dispatch** is a pure function keyed by kind:

   ```typescript
   resolveWorkspaceNoteIds(
     activation: WorkspaceActivation,
     context: { service, notes, savedViews, ruleCollections, databaseViews }
   ): string[] | null   // null = no workspace filter applied
   ```

3. **Entity records stay separate** — no merged localStorage blob. Each kind retains its own schema evolution path.

4. **Database Views are a sibling kind**, not a replacement for rule collections:
   - Rule Collection → note list filtered by query
   - Database View → alternate **presentation surface** (table/board/calendar) over the same query-resolved note set

### Answers to review questions

#### Q1 — Common abstraction?

**Yes, at the infrastructure level; no, at the product model level.**

| Layer | Abstraction |
| ----- | ----------- |
| Sidebar row | `WorkspaceItemRef { id, kind, name, subtitle?, count? }` |
| Activation | `WorkspaceActivation` discriminated union |
| Filter resolution | `WorkspaceFilterSource` enum + dispatch |
| Persistence record | Keep per-kind types (`SavedView`, `RuleCollection`, `DatabaseView`) |

Smart Collections are catalog-backed references (`SmartCollectionId`), not user records — they map to `WorkspaceItemRef` but never persist.

#### Q2 — Unified activation?

**Yes — recommended for K-9 prep, not required immediately.**

A single `activateWorkspace(kind, id)` in a future `useWorkspaceActivation` hook would:

- Clear folder, tag, and competing workspace kinds
- Apply kind-specific side effects (search box for saved views only)
- Return the new `WorkspaceActivation`

This removes ~40 lines of duplicated handler logic in `NoteView` without changing user-visible behavior.

#### Q3 — Sidebar simplification?

**Yes — extract a shared `WorkspaceSection` shell in the Database Views milestone.**

Proposed component API:

```typescript
interface WorkspaceSectionProps<T> {
  title: string;
  items: T[];
  activeId: string | null;
  getItemId: (item: T) => string;
  renderLabel: (item: T) => string;
  renderCount?: (item: T) => number;
  renderTitle?: (item: T) => string;
  onActivate: (item: T) => void;
  onClearActive: () => void;
  // optional CRUD slots
  createForm?: React.ReactNode;
  renderActions?: (item: T) => React.ReactNode;
}
```

Defer extraction until Database Views forces a 4th section — avoids premature abstraction over only three slightly-different sections.

#### Q4 — Database Views fit?

**DatabaseView is a `WorkspaceItemKind` subtype with an additional presentation dimension.**

```typescript
interface DatabaseView {
  id: string;
  name: string;
  query: string;              // same rule language as RuleCollection
  presentation: 'table' | 'board' | 'calendar';
  config: DatabaseViewConfig; // columns, groupBy, sort — future
}
```

Relationship to Rule Collections:

| | Rule Collection | Database View |
| - | --------------- | ------------- |
| Resolves notes via | `filterNotes(query)` | `filterNotes(query)` — same |
| Primary UI | Note list (sidebar selection) | Table / board / calendar panel |
| Persistence | `note-rule-collections-v1` | `note-database-views-v1` (proposed) |
| User intent | "My dynamic folder" | "Structured view over notes" |

A Rule Collection answers *which notes*. A Database View answers *which notes* **and** *how to display them*. They share query resolution; they differ in presentation shell.

**Recommended K-9 flow:**

```
DatabaseView.query → filterNotes → note ID set → TableView / BoardView / CalendarView
```

Database Views should **not** reimplement query parsing or index lookup.

#### Q5 — Unified persistence?

**Partial consolidation — shared utilities, separate storage keys.**

| Approach | Verdict |
| -------- | ------- |
| Single `workspace-v1` blob with tagged entries | ❌ Risky — couples unrelated migration paths |
| Shared `loadWorkspaceSlice(key, normalize)` helper | ✅ Reduces boilerplate |
| Separate keys per entity kind | ✅ Keep — enables independent schema versioning |

Proposed keys (current + future):

```
note-saved-views-v1
note-rule-collections-v1
note-database-views-v1      (future)
```

Smart Collections remain non-persisted (system catalog).

Optional future: export/import bundles all workspace keys together for backup — not required for K-9.

---

## 4. Migration Strategy

### Phase 0 — K-8.75 (this milestone)

- Publish this architecture document
- Add lightweight shared types in `workspace/workspaceModels.ts`
- **No NoteView refactor**

### Phase 1 — K-9 Database Views prep

1. Introduce `WorkspaceActivation` state in `NoteView` (replace 3 nullable IDs)
2. Extract `resolveWorkspaceFilter(notes, activation)` pure function
3. Add `DatabaseView` model + storage + sidebar section
4. Route Database View activation through same mutual-exclusion path

### Phase 2 — K-9+ sidebar consolidation

1. Extract `WorkspaceSection` shared component
2. Migrate Smart / Rule / Saved / Database sections incrementally
3. Keep entity-specific create forms as slot content

### Phase 3 — Optional deduplication

1. Extract shared `isValidKnowledgeQueryString()` (currently duplicated in savedViews + ruleCollections)
2. Extract shared CRUD helpers for `{ id, name, query }` records if a 5th query-backed entity appears

**Backward compatibility:** All migrations are additive. Existing localStorage keys remain valid. No data migration required for K-9 prep.

---

## 5. Database View Integration Plan

### Minimal K-9 architecture

```
┌─────────────────────────────────────────────────────────┐
│ NoteView                                                  │
│  ┌──────────────┐  ┌─────────────────────────────────┐ │
│  │ Sidebar       │  │ Main content area                │ │
│  │               │  │                                   │ │
│  │ Workspace     │  │ if databaseViewActive:            │ │
│  │ sections      │  │   DatabaseTableView(notes, cols)  │ │
│  │               │  │ else:                             │ │
│  │               │  │   Note list + editor (current)    │ │
│  └──────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         │
         ▼
  WorkspaceActivation { kind: 'database-view', id }
         │
         ▼
  DatabaseView.query → filterNotes(service, query) → NoteBase[]
         │
         ▼
  DatabaseTableView renders rows from filtered notes + property columns
```

### Shared with existing workspace

| Concern | Reuse |
| ------- | ----- |
| Query parsing | `parseQuery` |
| Index evaluation | `evaluateQuery` / `filterNotes` |
| Property columns | `KnowledgeIndexService.getProperties` |
| Tag columns | `KnowledgeIndexService.getTags` |
| Activation | `WorkspaceActivation` (future) |
| Counts | `filterNotes(...).notes.length` |

### New K-9 components (not in scope now)

- `DatabaseView` model + storage
- `DatabaseViewsSection` sidebar UI
- `DatabaseTableView` presentation component
- Column config (property keys to display)

### Explicit non-goals for K-9 foundation

- Board / calendar presentations (schema should allow, implementation deferred)
- Relations, rollups, formulas
- Workspace sharing

---

## 6. Technical Debt Assessment

| Item | Severity | Notes | Recommended action |
| ---- | -------- | ----- | ------------------ |
| Triple activation state in NoteView | Medium | 3 IDs + 3 handlers + repeated clears | Unify in K-9 prep (`WorkspaceActivation`) |
| Duplicated query validation | Low | `isValidSavedViewQuery` ≈ `isValidRuleCollectionQuery` | Extract shared helper in K-9 |
| Duplicated CRUD for query records | Low | SavedView and RuleCollection CRUD nearly identical | Accept until 5th entity; then generic helper |
| Duplicated sidebar section shells | Medium | 3 components, 2 nearly identical | Extract `WorkspaceSection` when Database Views lands |
| Saved View search coupling | Low (intentional) | Different deactivation semantics | Keep — product distinction |
| Smart collection sort override | Low | Special case in visibleNotes | Document; consider `preserveOrder` flag on filter source |
| NoteView workspace logic density | Medium | ~150 lines of workspace state/handlers/filter | Extract `useNoteWorkspace` hook in K-9 |
| No workspace module boundary | Low | Types scattered across views/ and collections/ | `workspace/` module started in K-8.75 |
| Header label priority chain | Low | 5-way ternary for active label | Map from `WorkspaceActivation` |
| Filter pipeline ordering implicit | Low | Order matters but is inline | Document in `resolveWorkspaceFilter` |

**No critical debt.** The workspace layer is young (3 milestones). Debt is manageable duplication in `NoteView`, not architectural rot. The recommended model prevents exponential growth when Database Views arrive.

---

## Summary

| Question | Recommendation |
| -------- | -------------- |
| Common abstraction? | Yes — infrastructure types (`WorkspaceActivation`, `WorkspaceItemRef`, filter dispatch). No — merged product entity. |
| Unified activation? | Yes — single discriminated union, deferred to K-9 prep |
| Sidebar simplification? | Yes — shared `WorkspaceSection`, deferred until Database Views |
| Database Views fit? | Sibling `WorkspaceItemKind` with shared query resolution, separate presentation |
| Unified persistence? | Shared load/save utilities; separate storage keys per kind |

Database Views can fit the reviewed architecture with **minimal redesign** if K-9 adopts `WorkspaceActivation` and routes all note-set resolution through `filterNotes` — the same path Rule Collections already use.

---

## Validation

This milestone introduces documentation and type definitions only.

Expected: `npm run typecheck` PASS · `npm test` PASS · `npm run build` PASS · no behavior changes · no UI changes.
