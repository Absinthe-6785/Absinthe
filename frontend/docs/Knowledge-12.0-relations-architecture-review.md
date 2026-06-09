# Knowledge-12.0 — Relations Architecture Review

## Scope

Architecture-only milestone. Determines the correct model for **Relations**, and future **Rollups** and **Formulas**, before implementation. **No user-facing relation features, no behavior changes, no UI changes.**

Evidence base: Properties (K-2), KnowledgeIndexService (K-1.5), Query Engine (K-7), Graph Layer (K-5/6), Database Layer (K-9–11.5), and K-11.5 consolidation review.

---

## 1. Architecture Report

### Current relationship landscape

| Mechanism | Origin | Persisted | Indexed | Directed |
| --------- | ------ | --------- | ------- | -------- |
| Wiki backlinks | `[[Title]]` in body | Body text | Yes (by title) | Yes |
| Mentions | Plain-text title match | Body text | Yes (O(N) scan) | Yes |
| Tags | `properties.tags` | Property string | Yes (tag index) | N/A (shared label) |
| Related notes | Composite score | In-memory cache | Yes | N/A |
| Properties | Frontmatter key/value | `note.properties` | Exact string match | N/A |

All current relationships are **content-derived** or **flat metadata**. None model **intentional, typed, note-to-note links** (Course ↔ Lecture, Project ↔ Task).

### Validated layering (unchanged)

```
NoteBase { body, properties }
        ↓
KnowledgeIndexService (indexes: backlinks, tags, properties, mentions, related)
        ↓
Query Engine → filterNotes
        ↓
DatabaseView / Graph / Workspace (presentation & derived views)
```

Relations belong in **KnowledgeIndexService** as a new indexed primitive. Database and Graph layers consume relations — they do not own them.

---

## 2. Relation Model Recommendation

### Q1 — What is a Relation?

| Option | Description | Verdict |
| ------ | ----------- | ------- |
| **A — Special property** | `course: Japanese N1` as string | ❌ Insufficient alone |
| **B — First-class entity** | `Relation { sourceId, targetId, propertyKey }` | ✅ Core model |
| **C — Hybrid** | Property UI + relation index | ✅ **Recommended** |

**Recommendation: Option C (Hybrid).**

**Justification:**

- **Option A alone** treats relations as opaque strings. Problems:
  - No stable note-id resolution (title renames break links)
  - `notesByProperty` indexes string equality, not graph edges
  - Reverse traversal requires full vault scan
  - Rollups (`count(Lectures)`) have no linked-note set to aggregate
  - Query clauses cannot express “linked to note X” without body scans

- **Option B** provides typed, indexed edges with O(1) forward/reverse lookup — required for query, graph, and rollup performance.

- **Option C** preserves the familiar **property authoring UX** (`course`, `project`, `person`) while storing **structured relation records** internally. Tags already follow this split: stored in `properties.tags`, indexed separately in `KnowledgeIndexService`.

### Recommended canonical shape

```typescript
/** Stored relation edge — directed, property-typed */
interface RelationEdge {
  sourceId: string;
  targetId: string;
  /** Property key defining relation type, e.g. "course", "project" */
  propertyKey: string;
}

/** Authoring may also accept target title; normalized to targetId on save */
interface RelationAuthoring {
  propertyKey: string;
  targetId?: string;
  targetTitle?: string;  // resolved via noteIdByTitleKey
}
```

Property keys remain the **relation type namespace** (`course`, `lecture`, `chapter`). Multiple relation keys per note are allowed (Course note links to many Lectures via inverse index).

---

## 3. Relation Storage Recommendation

### Q2 — One-way or bidirectional?

**Recommendation: Directed storage with automatic reverse indexing (logical bidirectionality).**

| Approach | Behavior |
| -------- | -------- |
| Write | User sets `course: [[Japanese N1]]` on a Lecture note → store `{ sourceId: lectureId, targetId: courseId, propertyKey: 'course' }` |
| Reverse index | `getNotesWithRelation('course', courseId)` returns all lectures — O(1) bucket lookup |
| Inverse display | Course note shows linked Lectures via reverse bucket — no duplicate user edit |

**Do not** require users to manually create reverse properties. **Do not** auto-create symmetric property keys (e.g. `lecture` on Course) unless the user defines an inverse schema later.

Reverse traversal is an **index concern**, not a duplicate authoring concern.

### Q3 — KnowledgeIndexService or Database Layer?

**Recommendation: KnowledgeIndexService.**

| Layer | Role for relations |
| ----- | ------------------ |
| **KnowledgeIndexService** | Store, index, query relation edges; extend `updateNote` / `removeNote` lifecycle |
| **Properties API** | Authoring surface; serialize/deserialize relation fields in frontmatter |
| **Query Engine** | New clause types evaluated via relation indexes |
| **Graph Layer** | Derive `GraphEdge` from relation index |
| **Database Layer** | Display relation columns, rollups — post-filter transforms only |

Database Views must **not** introduce a relation store or query engine (same K-9.75 rule as board/calendar).

### Proposed indexes (K-12.5+ implementation)

```typescript
// Forward: notes linked FROM source via propertyKey
relationsBySourceId: Map<noteId, RelationEdge[]>

// Reverse: notes linked TO target via propertyKey
notesByRelationTarget: Map<normKey, Map<targetId, Set<sourceId>>>

// Optional: distinct targets per key (for picker UI)
relationTargetsByKey: Map<normKey, Set<targetId>>
```

Incremental updates mirror `upsertNoteTags` / `upsertNoteProperties` on `updateNote`.

### Persistence

| Data | Location |
| ---- | -------- |
| Relation edges | New field on `NoteBase`, e.g. `relations?: RelationRecord[]`, **or** encoded in properties with index rebuild — prefer explicit field for clarity |
| Frontmatter | Serialize relation fields alongside properties |
| Index | In-memory only; rebuilt from notes on load |

**Backward compatibility:** Notes without `relations` field continue working. String properties that look like relations are **not** auto-migrated (explicit K-12.5 migration tool optional later).

---

## 4. Query Integration Plan

### Q4 — Can Relations participate in the Query Engine?

**Yes — feasible with additive clause types.** Current engine:

```typescript
type QueryClause =
  | { type: 'tag'; value: string }
  | { type: 'property'; key: string; value: string };
```

AND-only semantics via set intersection in `evaluateQuery`. Relations extend naturally.

### Proposed syntax (K-13+)

| Clause | Meaning | Index lookup |
| ------ | ------- | ------------ |
| `relation:course:"Japanese N1"` | Notes with `course` relation to resolved title | `getNotesWithRelation('course', targetId)` |
| `relation:course:note-id-123` | Notes linked to specific note id | Direct bucket |
| `linkedTo:"Japanese N1"` | Notes related to target via **any** relation key | Union of reverse buckets |
| `hasRelation:course` | Notes with any outgoing `course` relation | Forward index scan per key |

**Phase 1 query scope:** `relation:key:"Title"` and `hasRelation:key` — sufficient for Course/Lecture filtering.

**Not in initial scope:** OR/NOT, relation path queries (`course.lecture`), numeric relation constraints.

### Integration points

1. `parseQuery.ts` — extend `CLAUSE_RE` / tokenizer
2. `queryModels.ts` — extend `QueryClause` union
3. `evaluateQuery.ts` — call new `KnowledgeIndexService` methods
4. `filterNotes.ts` — unchanged contract; new clauses flow through existing path
5. Database Views — **unchanged query path**; `view.query` gains relation clauses when users choose

---

## 5. Graph Integration Plan

### Q5 — Should Relations become first-class graph edges?

**Yes — recommended for K-14+ graph milestone.**

Extend `GraphRelationshipType`:

```typescript
type GraphRelationshipType =
  | 'backlink' | 'mutual-backlink' | 'mention' | 'shared-tag'
  | 'relation';  // or `relation-${propertyKey}` for typed styling
```

| Graph | Relation edges |
| ----- | -------------- |
| **Local Graph** | Add relation neighbors in `buildNoteNeighborhood` — one hop via relation index |
| **Global Graph** | Add `'relations'` to `GlobalGraphRelationshipFilter` |
| **Expanded Graph** | Same hop rules as backlinks |

**Distinction from implicit edges:**

| Edge type | Source | User intent |
| --------- | ------ | ----------- |
| `backlink` | Wiki link in body | Content reference |
| `mention` | Plain text | Content reference |
| `relation` | Typed property | Structured domain model |

Both can coexist between the same note pair. Related-notes scoring may optionally weight explicit relations (future).

---

## 6. Database Integration Plan

### Q6 — Can Database Views display relations?

**Yes — without redesigning `DatabaseView`.**

Current model (K-11.5 validated):

```
DatabaseView.query → filterNotes → prepareDatabaseViewPresentation → render
```

Relations enter at two points:

### A — Query filtering (already supported path)

Database view query: `relation:course:"Japanese N1"` → standard `filterByDatabaseView`.

### B — Relation columns (K-14+ presentation extension)

Extend `DatabaseTableConfig`:

```typescript
interface DatabaseRelationColumnEntry {
  key: string;           // relation property key, e.g. "lecture"
  display: 'title' | 'count';
  visible: boolean;
}
```

Table cell resolution via new `getDatabaseRelationValue(note, key, service)`:
- `display: 'title'` → comma-separated linked note titles
- `display: 'count'` → rollup-ready count (see §7)

Board `groupBy` on relation keys: lanes = distinct **target note titles** (or ids). Calendar: relations unlikely unless relation carries date metadata on target.

**No changes required to `DatabaseView` core shape before K-13.** Add optional relation column metadata to `presentationConfig.table` when implementing relation columns.

---

## 7. Rollup Readiness Assessment

### Q7 — Can current architecture support rollups?

**Not today. Hybrid Option C + indexes enable them with additive changes.**

| Rollup example | Requirement | Current gap |
| -------------- | ----------- | ----------- |
| `count(Lectures)` | Reverse relation bucket size | No relation index |
| `latest(Lecture.updatedAt)` | Linked note ids + metadata read | No relation index |
| `sum(hours)` | Numeric property on linked notes | Properties exist; relation set missing |

### Rollup architecture (K-15+)

```typescript
interface DatabaseRollupConfig {
  relationKey: string;       // e.g. "lecture" (inverse: lectures of this course)
  aggregate: 'count' | 'latest' | 'sum' | 'list';
  field?: string;            // for sum/latest — property key on linked notes
}
```

**Compute model:** Post-filter, same as board grouping:

```
filterNotes → for each row note → getLinkedNotes(note, relationKey) → aggregate
```

O(n × k) where k = average linked count — acceptable for foundation. Index makes **linked-note lookup** O(1) per note; aggregation stays presentation-layer.

### Formula readiness (K-16+)

Formulas compose field values + rollups. Prerequisites:
1. Typed relation index (K-12.5)
2. Rollup compute helpers (K-15)
3. Expression evaluator (new module, not in index)

**No formula engine in KnowledgeIndexService** — formulas are presentation/compute, like sorting.

---

## 8. Option Analysis Summary

| Criterion | A — Property only | B — Dedicated model | C — Hybrid |
| --------- | ------------------- | ------------------- | ---------- |
| Reverse lookup | ❌ Scan | ✅ Index | ✅ Index |
| Rename safety | ❌ Title strings | ✅ Note ids | ✅ Note ids |
| Query integration | ⚠️ String match only | ✅ Typed clauses | ✅ Typed clauses |
| Authoring UX | ✅ Familiar | ⚠️ New UI | ✅ Property-like |
| Rollup support | ❌ | ✅ | ✅ |
| Migration | ✅ None | ⚠️ New field | ✅ Additive |
| KIS coherence | ⚠️ Overload properties | ✅ | ✅ (mirrors tags) |

**Recommendation: Option C — Hybrid.**

---

## 9. Migration Strategy

### Phase 0 — K-12.0 (this milestone)

- Publish architecture document
- Add forward-looking `relationModels.ts` types (documentation-first)
- **No runtime behavior changes**

### Phase 1 — K-12.5 Relation Foundation

1. Add `relations` field (or relation encoding) on `NoteBase`
2. Extend `KnowledgeIndexService` with relation indexes + lifecycle
3. Extend Properties API for relation authoring
4. Frontmatter serialization

### Phase 2 — K-13 Relation Queries

1. Extend `QueryClause` + parser + evaluator
2. Database view queries can filter by relation

### Phase 3 — K-14 Relation UI + Graph

1. Relation picker in properties panel
2. Graph edges from relation index
3. Database relation columns

### Phase 4 — K-15 Rollups

1. Rollup config on table presentation
2. `computeRollup(note, config, service)` post-filter helper

### Phase 5 — K-16 Formulas

1. Expression parser over field + rollup values
2. Computed columns (presentation only)

**Backward compatibility:** All phases additive. Existing notes, queries, database views, and graph behavior unchanged until users adopt relations.

---

## 10. Database Layer Pre-Relations Checklist

K-11.5 consolidation confirmed **no DatabaseView redesign needed**. Before K-13 relation columns:

| Item | Status |
| ---- | ------ |
| `presentationConfig` discriminated union | ✅ Ready for extension |
| `prepareDatabaseViewPresentation` dispatch | ✅ Add branch pattern exists |
| `getDatabaseFieldValue` shared resolver | ✅ Extend for relation display |
| `DatabasePropertyKeyField` | ✅ Reusable for relation key pickers |
| Query engine shared by database views | ✅ Relation clauses plug in cleanly |
| WorkspaceActivation | ✅ No change |

---

## Summary

| Question | Answer |
| -------- | ------ |
| What is a Relation? | **Hybrid (C):** first-class indexed edge, property-key typed, property-style authoring |
| One-way or bidirectional? | **Directed storage + reverse index** (logical bidirectionality) |
| KIS or Database Layer? | **KnowledgeIndexService** |
| Query Engine? | **Yes** — additive `relation:` / `hasRelation:` / `linkedTo:` clauses |
| Graph edges? | **Yes** — new `relation` edge type in local/global graph |
| Database Views? | **Yes** — relation columns + rollups via presentationConfig extensions |
| Rollup ready? | **After relation index** — post-filter aggregate, same pattern as board/calendar |
| Recommended option | **Option C — Hybrid** |

Relations, Rollups, and Formulas can extend the current architecture **without redesign** of DatabaseView, WorkspaceActivation, or the query/filter pipeline.

---

## Validation

This milestone introduces documentation and forward-looking type definitions only.

Expected: `npm run typecheck` PASS · `npm test` PASS · `npm run build` PASS · no behavior changes · no UI changes.
