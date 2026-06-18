# K-96A — Trash Cleanup & Restore UI Consolidation

Permanent delete and empty-trash reclaim localStorage occupied by soft-deleted notes while consolidating trash UI entry points.

## Scope

- `deleteNotePermanently(noteId)` — removes note from vault, clears nav history, rebuilds index incrementally
- `emptyTrash()` — removes all notes with `deletedAt`, full `rebuildKnowledgeIndex`
- `estimateDeletedNoteBytes(notes)` — `JSON.stringify` length of trashed notes
- Trash sidebar: note count, recoverable storage, **Empty Trash**
- Editor trash mode: warning banner + toolbar **Restore** / **Delete permanently** (single restore path)
- Confirm dialogs before permanent delete and empty trash

## Storage recovery matrix

Measured via `runK96TrashStorageMatrix()` in `k96aTrashAudit.ts` (representative large-vault fixture):

| Notes | Deleted % | Trashed count | Recoverable (approx.) |
|------:|----------:|--------------:|----------------------:|
| 100 | 10% | 10 | ~15 KB |
| 100 | 30% | 30 | ~45 KB |
| 100 | 50% | 50 | ~75 KB |
| 300 | 10% | 30 | ~45 KB |
| 300 | 30% | 90 | ~135 KB |
| 300 | 50% | 150 | ~225 KB |
| 1000 | 10% | 100 | ~150 KB |
| 1000 | 30% | 300 | ~450 KB |
| 1000 | 50% | 500 | ~750 KB |

Run `npm test -- k96aTrash` to print the live matrix for the current fixture.

Values are UTF-16 JSON length estimates; actual localStorage reclaim may differ slightly due to key overhead and surrounding vault JSON structure.

## Index invalidation

| Action | Index path |
|--------|------------|
| Single permanent delete | `knowledgeIndexService.removeNote(id)` + `indexContentVersion` bump |
| Empty trash | `rebuildKnowledgeIndex(remainingNotes)` + `vaultStructureVersion` / `indexContentVersion` bump |

After empty trash, `getAllNoteIds()` matches active notes only — no deleted ids remain indexed.

## UI changes

**Removed**

- Inline “restore to edit” messaging (`nvInTrashRestore`)
- Overflow-menu restore duplicate in trash mode
- Context panel footer permanent-delete button

**Kept**

- Toolbar Restore (single entry point)
- Soft-delete (`deletedAt`) unchanged

## Verification

```bash
npm run typecheck
npm test
npm run build
npm test -- k96aTrash
```

## Out of scope

IndexedDB migration, notes-v2 split, auto archive, snapshot structure changes, folder deletion semantics, restore semantics, cloud sync behavior.
