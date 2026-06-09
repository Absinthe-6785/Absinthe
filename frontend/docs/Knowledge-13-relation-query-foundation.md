# Knowledge-13 — Relation Query Foundation (Pre-Implementation)

## Scope

Extend the existing Query Engine with relation clause types. No UI, graph edges, rollups, or new query subsystem.

## K-12 foundation (unchanged)

- Storage: `note.relations` (ID-based, rename-safe)
- Index: `outgoingRelationsByNoteId`, `incomingRelationsByTargetId` in KIS
- Title resolution: `resolveNoteId()` via `noteIdByTitleKey`

## Query flow (unchanged pipeline)

```
Query string
  → tokenizeQuery() / parseQuery()
  → evaluateQuery()
  → KnowledgeIndexService indexes
  → Set<noteId>
  → filterNotes() / filterByDatabaseView() / filterByRuleCollection()
```

No RelationQueryEngine. Saved Views, Rule Collections, and Database Views inherit relation filtering automatically via `filterNotes()`.

## New clause types (Phase 1)

| Syntax | Clause type | KIS lookup |
| ------ | ----------- | ---------- |
| `hasRelation:course` | `hasRelation` | `getNotesWithOutgoingRelation(key)` — new forward-key index |
| `linkedTo:"Japanese N1"` | `linkedTo` | `resolveNoteId(title)` → `incomingRelationsByTargetId` sources |
| `relation:course:"Japanese N1"` | `relation` | resolve title → `getNotesWithRelation(key, targetId)` |

AND semantics preserved via existing set intersection in `evaluateQuery`.

## Parser changes

- Replace whitespace split with quote-aware tokenization (`relation:course:"Japanese N1"`)
- Reserved keys: `hasRelation`, `linkedTo`, `relation` (case-insensitive)
- `relation:` value uses nested `propertyKey:"title"` form

## KIS additions

- `notesWithOutgoingRelationKey: Map<normKey, Set<sourceId>>` for O(1) `hasRelation` lookup
- `getNotesLinkedTo(title)` — title → id → incoming edge sources
- `getNotesWithRelationToTitle(key, title)` — compose resolve + reverse bucket

## Policies

- **Case-insensitive**: property keys and titles (via existing normalizers)
- **Rename-safe**: queries use titles; storage uses IDs; title index updated on rename
- **Deleted target**: title resolution fails → `linkedTo` / `relation:` return empty; edges remain; `hasRelation` still matches sources

## Unchanged

Graph Layer, Database Layer structure, Workspace activation, Relation UI.
