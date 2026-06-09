# Knowledge-16.0 — Formula Architecture Review

## Scope

Architecture-only milestone. Defines the **Formula Engine**, **Computed Fields**, **Dependency Evaluation**, and **Formula → Rollup integration** before implementation. **No user-facing formula features, no behavior changes, no UI changes.**

Evidence base: Rollups Layer (K-15.0/K-15), Relations Layer (K-12.0–K-14), Database Layer (K-9–K-11.5), Query Engine (K-7/K-13), Properties (K-2), KnowledgeIndexService (K-1.5).

---

## Pre-Implementation Architecture Report

### Current state (post K-15)

```
NoteBase { properties, relations }
        ↓
KnowledgeIndexService
  - property / tag / relation indexes
  - getOutgoingRelations / getIncomingRelations
        ↓
Query Engine → filterNotes (tag / property / relation clauses)
        ↓
DatabaseView { query, presentation, presentationConfig }
        ↓
filterByDatabaseView → row notes
        ↓
getDatabaseFieldValue(note, key, service)     → property / metadata cells
computeRollup(note, definition, service)      → rollup cells (K-15)
        ↓
Table / Board / Calendar renderers
```

| Capability | Status |
| ---------- | ------ |
| Property fields | ✅ `getDatabaseFieldValue` |
| Rollup compute | ✅ `computeRollup` (Phase 1 functions) |
| Rollup columns | ✅ `DatabaseTableConfig.rollupColumns` |
| Formula evaluator | ❌ Not implemented |
| Formula columns | ❌ Not implemented |
| Formula queries | ❌ Not implemented |

### Validated layering (unchanged)

Formulas are **derived presentation values** — same category as rollups, table sort, and board grouping. They are not a new knowledge primitive and must not become a second property or query system.

**Hierarchy:**

```
Properties (stored on notes)
        ↓
Relations (stored edges, indexed in KIS)
        ↓
Rollups (computed aggregates over linked notes)
        ↓
Formulas (computed expressions over fields + rollups + metadata)
```

---

## 1. What Is a Formula?

### Option analysis

| Option | Description | Verdict |
| ------ | ----------- | ------- |
| **A — Stored value** | `completionRate: 75` persisted on the note | ❌ Reject as source of truth |
| **B — Computed value** | `completed / total` evaluated at read time | ✅ **Recommended core model** |
| **C — Computed + cache** | Computed + memoized during render | ✅ **Optional performance layer** |

### Recommendation: **Option B (computed) with optional in-memory memo (C-lite)**

**Reject stored values (A):**

- `completionRate` changes when any linked lecture is added, completed, or trashed — the Course note is not edited
- Storing computed ratios creates stale data, export drift, and sync conflicts
- Properties index is designed for flat string equality, not derived arithmetic

**Computed (B):**

- Always consistent with current property values, rollup outputs, and relation index state
- Matches rollups (K-15): `computeRollup` is read-time; formulas follow the same contract
- Example: `completionRate = completedLectures / totalLectures` where both operands are rollup inputs

**Memo (C-lite) — when needed, not persisted:**

- In-memory cache keyed by `(noteId, formulaDefinitionHash, indexGeneration, rollupCacheKey)` during a database view render pass
- Invalidation tied to KIS `updateNote` / `removeNote` and rollup input changes
- Never written to `NoteBase`, frontmatter, or localStorage

---

## 2. Where Should Formulas Live?

### Option analysis

| Option | Role | Verdict |
| ------ | ---- | ------- |
| **A — KnowledgeIndexService** | Index + formula storage | ❌ Overloads index; formulas are not indexable primitives in Phase 1 |
| **B — Database Layer only** | Presentation config + inline eval | ⚠️ Partial — owns config and UI binding |
| **C — Dedicated Formula Engine** | Expression parse + evaluate + dependency graph | ✅ **Recommended compute owner** |

### Recommendation: **Option C — Dedicated Formula Engine module, Database Layer owns config**

Split responsibilities (mirrors rollups):

| Layer | Formula responsibility |
| ----- | ---------------------- |
| **KnowledgeIndexService** | Provide property values, note metadata, relation APIs — **no formula semantics** |
| **Rollups module** | `computeRollup` → typed `RollupValue` inputs |
| **Formula Engine** (`formulas/`) | `FormulaDefinition`, parse/evaluate, dependency graph, error policy |
| **Database Layer** | `FormulaColumnDefinition` in `presentationConfig`, cell/card display |
| **Query Engine** | Unchanged in Phase 1; future post-filter (§7) |

**Justification:**

- K-15.0 established rollups as database presentation compute consuming KIS — formulas are the next layer with distinct concerns (expression parsing, DAG, type coercion)
- KIS mirrors tags/properties: index primitives, not presentation expressions
- A monolithic "database compute" would mix rollup aggregation and expression evaluation without clear boundaries

**Compute pipeline (K-16.5+ implementation):**

```
filterByDatabaseView(view)
  → buildFormulaDependencyGraph(view.formulaColumns)
  → for each row note (topological formula order)
      → resolve inputs: field / metadata / rollup / formula ref
      → evaluateFormula(expression, bindings)
      → FormulaValue { raw, display, error? }
  → render in table/board/calendar column
```

---

## 3. Formula Inputs

### Supported inputs

| Input type | Example | Phase | Verdict |
| ---------- | ------- | ----- | ------- |
| **Properties** | `priority * 10` | 1 | ✅ `{ type: 'field', key: 'priority' }` |
| **Rollups** | `completed / total` | 1 | ✅ `{ type: 'rollup', definition: RollupDefinition }` |
| **Built-in metadata** | `updatedAt`, `createdAt`, `title` | 1 | ✅ `{ type: 'metadata', key: 'updatedAt' }` |
| **Other formulas** | `progress * 1.5` | 1 | ✅ `{ type: 'formula', formulaKey: 'progress' }` |
| **Relations (direct)** | `count(relations.course)` | — | ❌ **Reject** |

### Recommendation: **Relations must become rollups first**

**Rationale:**

- Relations are note-to-note edge sets — not scalar values. Formulas operate on scalars (numbers, strings, dates, booleans)
- K-15 `computeRollup` already normalizes relation sets → count / sum / latest / etc.
- Direct relation access would duplicate rollup semantics and bypass missing-target policy
- Single direction keeps the dependency graph acyclic at the relation boundary

**Example:**

```
completedLectures  → rollup: count(incoming, course) where status=complete  [future filtered rollup]
totalLectures      → rollup: count(incoming, course)
completionRate     → formula: completedLectures / totalLectures
```

Phase 1 rollups do not filter by property; filtered rollups or conditional count are Phase 2+. Formulas consume whatever scalar rollup outputs.

---

## 4. Formula Language

### Phase 1 (K-16.5 recommended)

| Feature | Operators / syntax | Notes |
| ------- | ------------------ | ----- |
| **Arithmetic** | `+`, `-`, `*`, `/` | Numeric operands; division-by-zero → error |
| **Grouping** | `(`, `)` | Standard precedence |
| **Literals** | numbers, quoted strings | `"—"`, `0`, `1.5` |
| **Input references** | identifiers bound via `FormulaDefinition.inputs` | e.g. `completed / total` |

**Reject in Phase 1:** comparisons, boolean logic, function calls, string concatenation beyond display formatting.

### Phase 2

| Feature | Notes |
| ------- | ----- |
| **Comparisons** | `>`, `<`, `>=`, `<=`, `==`, `!=` → boolean |
| **Functions** | `IF(cond, a, b)`, `ROUND(x, n)`, `MIN(...)`, `MAX(...)` |
| **Coercion** | Explicit numeric parse of property strings |

### Future

| Feature | Notes |
| ------- | ----- |
| `AND` / `OR` / `NOT` | Boolean composition |
| `CONCAT(a, b)` | String assembly |
| `DATEADD`, `DATEDIFF` | Date arithmetic |
| Custom functions | Plugin / extension surface |

**Expression storage:** plain string on `FormulaDefinition.expression` with named input bindings — not embedded property paths. Keeps rename safety and explicit dependency declaration.

---

## 5. Dependency Graph

### Can formulas reference other formulas?

**Yes.** Example:

```
progress         = completed / total
weightedProgress = progress * 1.5
```

### Model: **Directed Acyclic Graph (DAG)**

| Concern | Strategy |
| ------- | -------- |
| **Tracking** | Each `FormulaColumnDefinition.key` is a node; edges from `type: 'formula'` inputs and cross-column references |
| **Evaluation order** | Topological sort (Kahn or DFS post-order) over acyclic graph |
| **Cycle detection** | DFS back-edge detection during graph build; mark cyclic nodes with `FormulaErrorCode.cyclic_dependency` |
| **Rollup inputs** | Leaf nodes — depend on KIS + `computeRollup`, not on other formulas |
| **Field/metadata inputs** | Leaf nodes — depend on note + KIS only |

**Rules:**

1. Formulas may reference other formulas **within the same database view** by column key
2. Rollups cannot reference formulas (§8) — guarantees rollups remain layer below formulas
3. Cycles are **configuration errors** surfaced at view load and per-cell eval time

```typescript
interface FormulaDependencyGraph {
  nodes: FormulaDependencyNode[];
  evaluationOrder?: string[];  // when acyclic
  cycles?: string[][];         // when cyclic
}
```

---

## 6. Database Integration

### Q6 — How formulas appear

| Option | Description | Verdict |
| ------ | ----------- | ------- |
| **A — FormulaColumn** | Typed column binding to `FormulaDefinition` | ✅ **Recommended** |
| **B — General ComputedField** | Single abstraction for rollups + formulas | ❌ Over-abstracts; rollups and formulas have different config shapes |

### Recommendation: **FormulaColumnDefinition** (parallel to `RollupColumnDefinition`)

Extend `DatabaseTableConfig`:

```typescript
interface DatabaseTableConfig {
  type: 'table';
  columns: DatabaseViewColumnEntry[];
  sort: DatabaseViewSort;
  rollupColumns?: RollupColumnDefinition[];   // K-15
  formulaColumns?: FormulaColumnDefinition[];  // K-16.5+
}
```

### View impact

| View | Impact |
| ---- | ------ |
| **Table** | Primary — formula columns alongside property and rollup columns |
| **Board** | Optional card badges via `cardFormulas?: FormulaColumnDefinition[]` on `DatabaseBoardConfig` (Phase 2) |
| **Calendar** | Optional card subtitle via formula field (Phase 2) — does not drive date placement |

**Sorting by formula columns:** Phase 2 — requires full-row compute before sort (same pattern as rollup-column sort).

### DatabaseView redesign?

**No.** Additive `presentationConfig` extension — same pattern as K-15 rollups.

---

## 7. Query Integration

### Should formulas participate in queries?

**Not in Phase 1.** Examples: `completionRate > 80`, `score >= 100`.

### Future direction (K-17+)

| Approach | Tradeoff |
| -------- | -------- |
| **Post-filter scan** | Evaluate view rows + formulas + filter in memory — O(n × f), simple |
| **Materialized formula index** | O(1) lookup — heavy invalidation, conflicts with computed model |
| **Query clause extension** | `formula:completionRate:>80` — parser + evaluator changes |

**Recommendation:** Start with **post-filter** over database view result set (same as future rollup queries). Formulas are not indexed in KIS. Saved views and rule collections inherit post-filter when query integration lands.

**Do not implement in K-16.0.**

---

## 8. Rollup Relationship

### Evaluation order

```
Relations (KIS indexes)
        ↓
Rollups (computeRollup)
        ↓
Formulas (evaluateFormula)
```

### Direction rule: **Formulas consume rollups; rollups do not consume formulas**

| Question | Answer |
| -------- | ------ |
| Can formulas consume rollups? | ✅ Yes — primary use case |
| Can rollups consume formulas? | ❌ No — would invert the layer stack and create circular dependencies |

**Rationale:**

- Rollups aggregate relation-linked note sets → scalars
- Formulas combine scalars → derived scalars
- Allowing rollup → formula would require rollups to wait on formula eval, breaking the clean pipeline validated in K-15.0

---

## 9. Error Handling Policy

| Condition | Behavior | `FormulaErrorCode` |
| --------- | -------- | ------------------ |
| **Missing property** | Treat as empty string or `0` for numeric context; display `—` with optional error flag | `missing_property` |
| **Missing rollup input** | Rollup returns `null` raw → formula sees `null`; numeric ops → error or 0 per coercion policy | `missing_rollup` |
| **Division by zero** | No throw; return `FormulaValue` with `error: 'division_by_zero'`, display `—` | `division_by_zero` |
| **Invalid expression** | Parse failure at config time; runtime fallback `—` | `invalid_expression` |
| **Type mismatch** | e.g. string `"abc"` in `*` → error, display `—` | `type_mismatch` |
| **Cyclic dependency** | Skip eval for cycle members; display `—` + error | `cyclic_dependency` |
| **Missing formula ref** | Unknown `formulaKey` → `missing_input` | `missing_input` |

**Policy principles:**

- **Never throw** during cell render — errors are values on `FormulaValue.error`
- **Fail visible** — `display: '—'` default for errors (matches rollup empty state)
- **Config validation** at view save/load: cycle detection, unknown input keys, empty expression

---

## 10. Performance Plan

### Scenario: 1000 rows × 20 formulas

| Strategy | Verdict |
| -------- | ------- |
| **Evaluate on every render** | ✅ Baseline — acceptable for foundation scale |
| **Memoize per render pass** | ✅ **Recommended** — cache `(noteId, formulaId) → FormulaValue` within single view render |
| **Dependency-aware cache** | ✅ Invalidate memo entry when any leaf input (property, rollup) changes for that note |
| **Persistent cache** | ❌ Reject — same rationale as stored formulas |

**Complexity:** O(rows × (rollups + formulas)) per render. With topological ordering, each formula eval is O(1) given cached inputs. Rollup cost dominates when formulas wrap rollups — reuse rollup memo from K-15 C-lite pattern.

**Profiling gate:** Add cross-row batching only if 1000×20 exceeds interaction budget.

---

## 11. Formula Model Recommendation

### Option analysis

| Option | Description | Verdict |
| ------ | ----------- | ------- |
| **A — Formulas inside note properties** | User-editable expression keys on notes | ❌ Conflates data with presentation |
| **B — FormulaDefinition on DatabaseView** | View-scoped expression config | ✅ **Recommended** |
| **C — Hybrid** | View definitions + per-note overrides | ⚠️ Defer — YAGNI |

### Canonical model (`formulas/formulaModels.ts`)

```typescript
interface FormulaDefinition {
  id: string;
  expression: string;
  inputs: Record<string, FormulaInput>;
  returnType?: FormulaReturnType;
}

type FormulaInput =
  | { type: 'field'; key: string }
  | { type: 'rollup'; definition: RollupDefinition }
  | { type: 'metadata'; key: 'updatedAt' | 'createdAt' | 'title' }
  | { type: 'formula'; formulaKey: string };

interface FormulaValue {
  raw: number | string | boolean | null;
  display: string;
  error?: FormulaErrorCode;
}
```

---

## 12. Graph Review

### Do formulas have graph implications?

**No direct graph edges.**

| Concern | Answer |
| ------- | ------ |
| New edge types | ❌ Formulas are not relationships |
| Local / global graph | ❌ No change |
| Graph filters | ❌ Unaffected |

**Rationale:** A formula is a **scalar derived from properties, rollups, and metadata**. Visualizing `75%` on a Course row is database presentation, not graph topology. Relation edges remain the graph's structural primitive (K-14).

---

## 13. Migration Strategy

### Phase 0 — K-16.0 (this milestone)

- Publish architecture document
- Add forward-looking `formulaModels.ts` types + dependency graph helpers
- **No runtime behavior changes**

### Phase 1 — K-16.5 Formula Foundation

1. `evaluateFormula(definition, bindings, service)` helper
2. `FormulaColumnDefinition` on table presentation config
3. Table cell rendering for formula columns
4. Tests: arithmetic, rollup inputs, division by zero, cycle detection

### Phase 2 — K-16.75 Formula UX

1. Formula column authoring in database view controls
2. Phase 2 language (comparisons, IF/ROUND/MIN/MAX)
3. Board/calendar card formula badges
4. Optional formula-column sort

### Phase 3 — K-17 Query Integration (optional)

1. Post-filter formula predicates
2. Saved view / rule collection integration if needed

**Backward compatibility:** All phases additive. Existing notes, relations, rollups, database views, queries, and graph behavior unchanged until users configure formula columns.

---

## Summary

| Question | Answer |
| -------- | ------ |
| What is a Formula? | **Computed (B)** at read time; optional in-memory memo, never stored on notes |
| Where do formulas live? | **Dedicated Formula Engine** (`formulas/`) + **Database Layer** for column config |
| Formula inputs | **Properties, rollups, metadata, other formulas** — relations via rollups only |
| Phase 1 language | **Arithmetic + grouping + input refs** |
| Phase 2 language | **Comparisons + IF/ROUND/MIN/MAX** |
| Dependencies | **DAG** with topological eval order + DFS cycle detection |
| Database integration | **`FormulaColumnDefinition`** on `DatabaseTableConfig.formulaColumns` |
| Query integration | **Future** post-filter — not Phase 1 |
| Rollup direction | **Formulas → rollups only** (one direction) |
| Error handling | **Non-throwing `FormulaValue.error`** — display `—` |
| Performance | **Per-render memo** with dependency invalidation |
| Storage | **FormulaDefinition on DatabaseView** (Option B) |
| Graph impact | **None** |
| DatabaseView redesign? | **No** — additive presentationConfig extension |

Formulas extend the current architecture **without redesign** of KnowledgeIndexService, Query Engine, Graph Layer, Rollup module, or DatabaseView core shape.

---

## Validation

This milestone introduces documentation and forward-looking type definitions only.

Expected: `npm run typecheck` PASS · `npm test` PASS · `npm run build` PASS · no behavior changes · no UI changes.
