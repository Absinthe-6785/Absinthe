# K-96B — IndexedDB Note Storage Migration

Moves full note records from `localStorage` (`notes-v2`) to IndexedDB while keeping folders, settings, workspace, and other keys in `localStorage`.

## Architecture

| Layer | Role |
|-------|------|
| `noteIndexedDb.ts` | IndexedDB CRUD — `loadNotesFromIndexedDb`, `saveNotesToIndexedDb`, `deleteNoteFromIndexedDb`, `clearIndexedDbNotes` |
| `notePersistence.ts` | One-time migration, fallback, cross-tab revision (`notes-idb-rev-v1`) |
| `noteUtils.ts` | Sync `loadNotes` / `saveNotes` bridge for existing callers |
| `useNotesStore.ts` | `initNotesStorage()` at startup; async `saveNotesAsync` on persist |

## Migration flow

```
startup → initNotesStorage()
  ↓
IndexedDB unavailable? → localStorage fallback + syncError
  ↓
Migration marker set? → load from IndexedDB
  ↓
IndexedDB empty? → read notes-v2 → write IndexedDB → set marker → remove notes-v2
  ↓
Future loads use IndexedDB (notes-v2 ≈ 0 bytes)
```

## Fallback

If IndexedDB open/read/write fails:

```
syncError = "IndexedDB unavailable. Falling back to local storage."
```

The app continues using `notes-v2` in `localStorage`.

## Cross-tab sync

IndexedDB writes bump `notes-idb-rev-v1` in `localStorage`. Other tabs reload notes from IndexedDB on that storage event.

## Audit matrix

Run `npm test -- k96bIndexedDb` to print migration metrics at 100 / 300 / 1000 / 3000 notes:

- `localStorage` bytes before (full `notes-v2` JSON)
- `localStorage` bytes after migration (~0)
- IndexedDB record count
- migration / load / startup timing

## Verification

```bash
npm run typecheck
npm test
npm run build
npm test -- k96bIndexedDb
```

## Out of scope

Note schema changes, KnowledgeIndexService changes, graph/discovery changes, folder/sync protocol changes, K-95 optimizations.

## After K-96 series

Resume unfinished K-95 index memory optimization work once K-96A/B/C/D are complete.
