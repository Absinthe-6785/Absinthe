# Knowledge-14 — Relation UI + Graph Integration (Pre-Implementation)

## Scope

Expose K-12.5/K-13 relation infrastructure in the Note UI and graph layers. No database columns, rollups, or query changes.

## UI placement

Right sidebar tab **Relations** alongside Links, Props, Tags. Dedicated `NoteRelationsPanel` — not embedded in properties panel.

## Data flow

```
NoteRelationsPanel
  → noteRelations helpers (add/remove/set)
  → noteUpdate({ relations })
  → useNotesStore.updateNote
  → knowledgeIndexService.updateNote
```

Display reads from KIS only: `resolveRelationTargets`, `getIncomingRelations`, `getNoteTitle`.

## Target selection

Reuse `filterWikiTargets` + note title list from NoteView (`wikiTargets`). Resolve to note ID via `resolveNoteId` / `findNoteByTitle`. Store IDs only.

## Graph integration

Extend `GraphRelationshipType` with `'relation'`. Weight: `RELATED_SCORE.RELATION` (8).

| Builder | Change |
| ------- | ------ |
| `buildNoteNeighborhood` | Outgoing + incoming relation edges via KIS |
| `buildGlobalGraphData` | All outgoing relation edges; filter `'relations'` |
| `LocalGraphView` | Green dashed stroke; relationship filter dropdown |
| `NoteGraphView` | Relations filter option; distinct edge styling |

## Policies

- Deleted target: show "Missing target", navigate disabled
- Rename: titles from KIS update automatically
- Self-links: prevented in editor

## Unchanged

Query Engine, Database Layer, rollups, formulas.
