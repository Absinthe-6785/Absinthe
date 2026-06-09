# Knowledge-12.5 — Relation Storage & Index Foundation (Pre-Implementation)

## Scope

Infrastructure-only milestone: persisted note-id relations + KnowledgeIndexService indexes. No UI, queries, graph edges, or rollups.

## K-12.0 decisions applied

- **Option C hybrid** — structured `note.relations` storage; indexed in KIS
- **Directed edges** with reverse index buckets
- **ID-based** — rename-safe; missing targets resolve like broken links
- **Delete policy** — edges retained when target trashed; resolve as missing

## Storage shape

```typescript
NoteBase.relations?: Record<string, string[]>
// propertyKey → target note ids (directed, outgoing from this note)
```

Frontmatter export/import via YAML `relations:` block (parallel to `tags:`).

## Index shape

```
relationsBySourceId: Map<sourceId, RelationEdge[]>
incomingRelationsByTargetId: Map<targetId, RelationEdge[]>
```

Reverse lookup `getNotesWithRelation(key, targetId)` uses incoming index filtered by propertyKey.

## Lifecycle

`buildFromNotes` → `upsertNoteRelations` per note  
`updateNote` → remove old outgoing index → upsert  
`removeNote` → strip outgoing index only; stored edges on other notes unchanged

## Unchanged layers

Query Engine, Graph Layer, Database Layer — no modifications in K-12.5.
