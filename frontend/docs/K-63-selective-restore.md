# K-63 Selective Restore

## Goal

Allow users to restore only chosen folders and notes before import, while preserving Skip / Replace / Duplicate conflict handling from K-62.

## Flow

1. User selects backup file (`.json` or `.zip`)
2. `buildVaultRestorePreview()` validates manifest and builds folder/note options
3. Modal shows validation report + checkboxes (folders expand to notes)
4. User toggles selection; **Select all** / **Select none** shortcuts available
5. On confirm, `filterManifestBySelection()` produces a subset manifest
6. `importVaultRestore()` applies conflict strategy to the filtered set only

## Selection Model

```typescript
interface VaultRestoreSelection {
  noteIds: ReadonlySet<string>;
  folderIds: ReadonlySet<string>;
}
```

- **Folder checkbox** — toggles all notes in that folder
- **Note checkbox** — individual note toggle
- **Unfiled** — virtual folder `__unfiled__` for notes without `folderId`
- Import button disabled when zero notes selected

## Conflict Strategies (unchanged)

| Strategy | Behavior |
|----------|----------|
| `skip` | Keep local note when IDs collide |
| `replace` | Overwrite local with backup content |
| `duplicate` | Import as new note with fresh ID |

Conflict UI appears only when `conflictCount > 0` in the selected subset.

## Filtering Rules

`filterManifestBySelection()`:

- Keeps only notes in `selection.noteIds`
- Keeps folders that are both selected and referenced by at least one selected note
- Recomputes `noteCount`, `folderCount`, `relationCount` on filtered manifest

## UI

`VaultRestoreModal` displays:

- Validation grid: Notes, Folders, Relations, Conflicts
- Metadata: export date, app version, backup schema version
- Scrollable folder/note tree with checkboxes

## Limitations

- No per-relation selective restore (relations travel with selected notes)
- Group/workspace presets are not separate backup entities (folder-level only)
