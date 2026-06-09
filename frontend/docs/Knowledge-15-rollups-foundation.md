# Knowledge-15 — Rollups Foundation (Pre-Implementation)

## Scope

Implement computed relation rollups in Database table views. No formula engine, rollup queries, or persisted values.

## Pipeline (K-15.0)

```
DatabaseView.query → filterNotes() → prepareDatabaseViewRows() → render
                                              ↓
                              computeRollup(note, definition, service, notesById)
```

Rollup values computed at render time per row note.

## Model

- `RollupDefinition` on `DatabaseTableConfig.rollupColumns`
- Default `direction: 'incoming'` (lecture count on Course)
- Linked note IDs from KIS; metadata from `notesById` map

## Phase 1 functions

`count`, `list`, `latest`, `sum`, `first`, `last`

## Integration points

| File | Change |
| ---- | ------ |
| `databasePresentationModels.ts` | `rollupColumns` on table config |
| `computeRollup.ts` | evaluation |
| `databaseViewOperations.ts` | rollup column CRUD |
| `DatabaseTableView.tsx` | rollup cell rendering |
| `DatabaseViewControls.tsx` | rollup column UI |

KIS unchanged — index only.
