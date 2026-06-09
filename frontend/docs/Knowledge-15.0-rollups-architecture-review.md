# Knowledge-15.0 — Rollups Architecture Review

## Scope

Architecture-only milestone. Determines the correct model for **Rollups** and future **Formula Engine** foundations before implementation. **No user-facing rollup features, no behavior changes, no UI changes.**

Evidence base: Relations Layer (K-12.0–K-14), Database Layer (K-9–K-11.5), Query Engine (K-7/K-13), Properties (K-2), KnowledgeIndexService (K-1.5).

---

## 1. Architecture Report

### Current state (post K-14)

```
NoteBase { properties, relations: Record<propertyKey, targetId[]> }
        ↓
KnowledgeIndexService
  - outgoingRelationsByNoteId / incomingRelationsByTargetId
  - getOutgoingRelations / getIncomingRelations / getNotesWithRelation
  - resolveRelationTargets (missing policy)
        ↓
Query Engine → filterNotes (relation: / hasRelation: / linkedTo:)
        ↓
DatabaseView { query, presentation, presentationConfig }
        ↓
getDatabaseFieldValue(note, key, service) → string cell values
        ↓
Table / Board / Calendar renderers
```

**Relations are indexed and queryable. Computed aggregates over linked notes do not exist.**

| Capability | Status |
| ---------- | ------ |
| Relation edges | ✅ Indexed in KIS |
| Reverse lookup (incoming) | ✅ O(1) bucket |
| Relation queries | ✅ K-13 |
| Relation UI + graph | ✅ K-14 |
| Rollup compute | ❌ Not implemented |
| Formula engine | ❌ Not implemented |
| Rollup columns in database views | ❌ Not implemented |

### Validated layering (unchanged)

Rollups are **derived presentation values** — same category as table sort, board grouping, and calendar bucketing. They are not a new knowledge primitive and must not become a second relation or query system.

---

## 2. What Is a Rollup?

### Option analysis

| Option | Description | Verdict |
| ------ | ----------- | ------- |
| **A — Stored property** | `lectureCount: 3` persisted on the Course note | ❌ Reject as source of truth |
| **B — Computed property** | `count(incoming:course)` evaluated at read time | ✅ **Recommended core model** |
| **C — Hybrid cache** | Computed + cached + invalidated | ✅ **Optional performance layer** |

### Recommendation: **Option B (computed) with optional presentation-layer cache (C-lite)**

**Justification for rejecting stored properties (A):**

- Lecture count changes when any linked Lecture is added, removed, or trashed — the Course note is not edited
- Storing `lectureCount` on notes creates stale data, export/import drift, and sync conflicts
- Properties index (`notesByProperty`) is designed for flat string equality, not derived aggregates
- Relation rename safety (ID-based edges) already works; stored counts would need duplicate invalidation logic

**Justification for computed (B):**

- Always consistent with relation index + linked note metadata
- Matches existing database patterns: `getDatabaseFieldValue` reads at render time; board lanes derive at render time
- Delete policy (missing targets) composes naturally — count can exclude or include missing per policy

**Hybrid cache (C-lite) — when needed, not persisted:**

- In-memory memo keyed by `(noteId, rollupDefinitionHash, indexGeneration)` during a database view render pass
- Invalidation tied to KIS `updateNote` / `removeNote` lifecycle — not written to `NoteBase` or localStorage
- Avoid a dedicated cache store until profiling shows O(n × k) rollup cost is a bottleneck

**Example:**

```
Course "Japanese N1"
  incoming relations (propertyKey: course) → [lecture-1, lecture-2, lecture-3]
  rollup: count(incoming, course) → 3   // computed at read time
```

---

## 3. Where Should Rollups Live?

### Option analysis

| Option | Role | Verdict |
| ------ | ---- | ------- |
| **A — Database Layer** | Presentation config + compute helpers | ✅ **Recommended owner for definitions + UI config** |
| **B — KnowledgeIndexService** | Index + aggregate storage | ❌ Overloads index responsibility |
| **C — Dedicated Rollup Engine** | Separate subsystem | ❌ Unnecessary indirection |

### Recommendation: **Database presentation compute layer consuming KIS**

Split responsibilities:

| Layer | Rollup responsibility |
| ----- | --------------------- |
| **KnowledgeIndexService** | Provide linked note IDs (outgoing/incoming), note titles, properties, `updatedAt` — **no rollup semantics** |
| **Database Layer** | `RollupDefinition` in `presentationConfig`, `computeRollup(note, definition, service)`, cell/card display |
| **Query Engine** | Unchanged in Phase 1; future rollup predicates optional (§6) |
| **Formula Engine (K-16+)** | Consumes rollup outputs as typed inputs — separate module |

**Justification:**

- K-12.0/K-9.75 established: database views own presentation transforms post-`filterNotes`
- KIS mirrors tags/properties pattern: index primitives, not presentation aggregates
- A "Rollup Engine" would duplicate the database row pipeline (`filterNotes → transform → render`) with no new selection semantics

**Compute pipeline (K-15.5+ implementation):**

```
filterByDatabaseView(view)
  → for each row note
      → resolve linked notes via KIS (direction + relationKey)
      → aggregate (count / sum / latest / …)
      → RollupValue { raw, display }
  → render in table/board/calendar column
```

Complexity: O(rows × linkedCount) per view render — acceptable for foundation scale. KIS makes linked-note lookup O(1) per edge bucket.

---

## 4. How Rollups Relate to Relations

### Primary source: **relations only (Phase 1–2)**

Rollups aggregate over **linked notes** resolved through relation indexes.

```typescript
interface RollupDefinition {
  relationKey: string;           // e.g. "course"
  direction: 'outgoing' | 'incoming';
  function: RollupFunction;
  targetField?: string;          // property on linked notes (sum, latest, …)
}
```

| Scenario | Direction | Example |
| -------- | --------- | ------- |
| Course → count lectures | `incoming` | Lectures have `course → courseId` |
| Lecture → course title | `outgoing` | Single-target list/show |
| Project → count tasks | `incoming` | Tasks link to project |

**Incoming vs outgoing:** The K-14 lecture-count example requires **`direction: 'incoming'`** on the Course note — lectures store outgoing edges; the aggregate counts sources in the incoming bucket filtered by `propertyKey`.

### Should rollups also use tags, backlinks, mentions?

| Source | Recommendation | Rationale |
| ------ | -------------- | --------- |
| **Relations** | ✅ Phase 1 | Typed, ID-stable, indexed, user-intentional |
| **Tags** | ❌ Not rollups | Shared labels, not note-to-note sets; use queries (`tag:x`) |
| **Backlinks** | ⚠️ Future optional | Content-derived, title-based; different semantics from typed relations |
| **Mentions** | ❌ Not rollups | Implicit content matches; use related-notes / graph |

**Recommendation:** Phase 1 rollups operate **only on relations**. If backlink-count aggregates are needed later, introduce a separate `RollupSource: 'relation' | 'backlink'` discriminant — do not overload relation rollups.

### Missing targets

Align with K-12.5/K-14 relation policy:

- Edges to deleted/trashed notes **remain** in storage
- Rollup policy options (K-15.5): `includeMissing: false` (default for count) vs show missing count separately
- `RollupValue.missingTargets` for UI transparency

---

## 5. Rollup Function Set

### Phase 1 (K-15.5 recommended)

| Function | Input | Output | Notes |
| -------- | ----- | ------ | ----- |
| `count` | Linked note set | number | Primary lecture-count use case |
| `list` | Linked note set | string[] | Comma-separated titles in UI |
| `latest` | Linked notes + `targetField` or `updatedAt` | string/date | Most recent by parsed date or note metadata |
| `sum` | Linked notes + numeric `targetField` | number | Requires numeric parse policy |
| `first` | Linked notes + sort key | string | Ordered pick — first title or earliest |
| `last` | Linked notes + sort key | string | Ordered pick — last title or latest |

### Phase 2

| Function | Notes |
| -------- | ----- |
| `average` | Requires numeric field + count |
| `min` / `max` | Numeric or lexicographic on field |
| `earliest` | Date-specific alias of first by date |

### Future

| Function | Notes |
| -------- | ----- |
| `percentComplete` | Formula-dependent — ratio of two rollups |
| `unique` | Distinct values across linked set |
| Custom sort expressions | Formula engine territory |

**Reject in Phase 1:** cross-database joins, graph traversal rollups, query-style filters inside rollup definitions.

---

## 6. Database Integration Plan

### Q5 — How rollups appear in Table / Board / Calendar

**No `DatabaseView` core redesign required** (K-9.75 / K-11.5 validated). Additive extensions to `presentationConfig`.

### Table View (primary)

Extend `DatabaseTableConfig`:

```typescript
interface DatabaseRollupColumnEntry {
  key: string;              // column id, e.g. "lectureCount"
  label?: string;
  visible: boolean;
  rollup: RollupDefinition;
}

interface DatabaseTableConfig {
  type: 'table';
  columns: DatabaseViewColumnEntry[];
  rollupColumns?: DatabaseRollupColumnEntry[];  // K-15.5+
  sort: DatabaseViewSort;
}
```

Cell resolution: extend `getDatabaseFieldValue` or parallel `getDatabaseRollupValue(note, column, service)`.

Example:

| Title | Lectures |
| ----- | -------- |
| N1    | 24       |

→ `rollup: { relationKey: 'course', direction: 'incoming', function: 'count' }`

### Board View

- **Group-by:** unchanged — property keys only (not rollups)
- **Card fields:** optional rollup badges via `cardRollups?: RollupDefinition[]` on `DatabaseBoardConfig`
- Rollups are **display enrichment**, not lane assignment in Phase 1

### Calendar View

- **Date property:** unchanged — rollups do not drive calendar placement
- **Card subtitle:** optional rollup field (e.g. task count on due-date cards)
- Unscheduled bucket logic unaffected

### Sorting by rollup columns

Phase 2 — requires computed values for all rows before sort (same pattern as sorting by property). Phase 1: display only, no rollup-column sort.

---

## 7. Query Integration Plan

### Should rollups be queryable?

**Not in Phase 1.** Examples like `lectureCount > 10` require numeric predicates over computed values.

### Future direction (K-17+ or query milestone)

| Approach | Tradeoff |
| -------- | -------- |
| **Post-filter scan** | Evaluate view rows + rollup + filter in memory — simple, O(n) |
| **Materialized rollup index in KIS** | O(1) lookup for queries — adds invalidation complexity |
| **Query clause extension** | `rollup:lectureCount:>10` — requires parser + evaluator changes |

**Recommendation:** Start with **post-filter** for prototype queries; introduce indexed rollup buckets only if performance requires it. Do not store rollup results as queryable properties.

**Formula-derived filters** (e.g. `completionRate >= 80`) belong to Formula Engine + query integration — after K-16.

---

## 8. Formula Readiness Assessment

### Future example

```
progress = completedLectures / totalLectures
```

### Prerequisites

1. ✅ Relation index (K-12.5)
2. ⏳ Rollup compute helpers (K-15.5)
3. ⏳ Expression evaluator (K-16 — new module)

### Architecture for formula inputs

```typescript
type FormulaInput =
  | { type: 'field'; key: string }
  | { type: 'rollup'; definition: RollupDefinition };

interface FormulaDefinition {
  id: string;
  expression: string;           // e.g. "completed / total"
  inputs: Record<string, FormulaInput>;
}
```

**Rollups provide typed numeric/string inputs** to the formula layer. Formulas are **computed at read time** (same as rollups) — not stored on notes.

**Location:** Formula evaluator lives in a **dedicated compute module** (sibling to rollup compute), not in KIS or Query Engine initially.

**Dependency graph:**

```
RelationEdge (KIS)
  → RollupDefinition + computeRollup (Database compute)
    → FormulaDefinition + evaluateFormula (Formula compute)
      → Database formula columns (presentation)
```

---

## 9. Rollup Definition Storage

### Option analysis

| Option | Description | Verdict |
| ------ | ----------- | ------- |
| **A — Rollup definitions in note properties** | User-editable property keys | ❌ Conflates data with presentation |
| **B — Dedicated RollupDefinition on DatabaseView** | Config on view presentation | ✅ **Recommended** |
| **C — Hybrid** | Definitions on view + optional note-level overrides | ⚠️ Defer — YAGNI until per-note rollup overrides are requested |

### Recommendation: **Option B — RollupDefinition in DatabaseView presentationConfig**

- Rollups are **view-scoped presentation** — same as columns, sort, groupBy, dateProperty
- Different database views can show different rollups over the same notes
- Export/import: rollups travel with database view JSON, not note frontmatter
- No change to `NoteBase` shape

Legacy `RelationRollupConfig` in `relationModels.ts` remains a forward-looking alias; canonical types move to `rollups/rollupModels.ts`.

---

## 10. Graph Review

### Do rollups have graph implications?

**No direct graph edges.**

| Concern | Answer |
| ------- | ------ |
| New edge types | ❌ Rollups are not relationships |
| Local / global graph | ❌ No change — graph shows relation edges (K-14), not counts |
| Graph filters | ❌ Unaffected |
| Related notes scoring | ⚠️ Future: optional weight boost if explicit relation exists — separate from rollups |

**Rationale:** A rollup is a **scalar derived from existing relation edges**. Visualizing "24" on a Course node is database/cell presentation, not graph topology.

---

## 11. Database Architecture Review

### Does DatabaseView need redesign before rollups?

**No.** K-10/K-11 established discriminated `presentationConfig`. Rollups extend table config additively.

| Item | Status |
| ---- | ------ |
| `presentationConfig` discriminated union | ✅ Extend `DatabaseTableConfig` |
| `prepareDatabaseViewPresentation` dispatch | ✅ Add rollup column branch |
| `getDatabaseFieldValue` shared resolver | ✅ Extend or sibling `getDatabaseRollupValue` |
| `filterByDatabaseView` | ✅ Unchanged — rollups post-filter |
| WorkspaceActivation | ✅ Unchanged |
| Board / calendar configs | ✅ Optional rollup display fields |

---

## 12. Migration Strategy

### Phase 0 — K-15.0 (this milestone)

- Publish architecture document
- Add forward-looking `rollupModels.ts` types
- **No runtime behavior changes**

### Phase 1 — K-15.5 Rollup Foundation

1. `computeRollup(note, definition, service)` helper
2. `DatabaseRollupColumnEntry` on table presentation config
3. Table cell rendering for rollup columns
4. Tests: count, sum, latest, incoming direction, missing targets

### Phase 2 — K-15.75 Rollup UX

1. Rollup column authoring in database view controls
2. Board card rollup badges
3. Optional rollup-column sort

### Phase 3 — K-16 Formula Engine

1. `FormulaDefinition` + expression evaluator
2. Formula columns consuming field + rollup inputs

### Phase 4 — K-17 Query Integration (optional)

1. Rollup-aware filters (post-compute or indexed)
2. Saved views / rule collections if needed

**Backward compatibility:** All phases additive. Existing notes, relations, database views, queries, and graph behavior unchanged until users configure rollup columns.

---

## Summary

| Question | Answer |
| -------- | ------ |
| What is a Rollup? | **Computed (B)** at read time; optional in-memory cache, never stored as note property |
| Where do rollups live? | **Database presentation compute** consuming **KIS** relation APIs |
| Relation to relations? | **Relations only** in Phase 1; incoming/outgoing direction explicit |
| Phase 1 functions | `count`, `list`, `latest`, `sum`, `first`, `last` |
| Database integration | **Extend `DatabaseTableConfig.rollupColumns`**; board/calendar optional display |
| Query integration | **Future** — post-filter first; no Phase 1 implementation |
| Formula readiness | Rollups → formula inputs; evaluator separate from KIS |
| Definition storage | **RollupDefinition on DatabaseView** (Option B) |
| Graph impact | **None** |
| DatabaseView redesign? | **No** — additive presentationConfig extension |

Rollups and Formulas extend the current architecture **without redesign** of KnowledgeIndexService relation storage, Query Engine, Graph Layer, or DatabaseView core shape.

---

## Validation

This milestone introduces documentation and forward-looking type definitions only.

Expected: `npm run typecheck` PASS · `npm test` PASS · `npm run build` PASS · no behavior changes · no UI changes.
