# Notes v1.0

Notes v1.0 is declared stable for production use with the following scope.

## Included

- Unified `useNotesStore` (NoteView + Planner Memo)
- Block editor with markdown round-trip
- Wiki links, backlinks, tag search
- Cloud sync (localStorage + Supabase upsert)
- Per-note body debounce sync
- Trash, folders, starred, import/export
- Settings reset with local + DB wipe
- Multi-tab localStorage merge via `storage` event + `updatedAt` merge

## Known limitations (v1.0)

- Same note edited simultaneously in two tabs: last `updatedAt` wins per note id
- Very large notes may hit browser `localStorage` quota
- `starred` requires DB column (legacy schema strips silently on server)
- Offline trashed local-only notes may not survive hydrate when DB has other data

## Test status

Run `cd frontend && npm run test` — 60 unit/integration tests.
