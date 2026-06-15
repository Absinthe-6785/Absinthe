# K-66 Navigation Continuity

## Problem (K-65)

Note back/forward worked during active exploration but was lost on:
- Full page refresh
- Long idle (module re-init edge cases)
- `seedNoteNavigationStack(null)` clearing history

## Solution

### Session persistence

`noteNavigationStack.ts` persists to `sessionStorage` key `absinthe.noteNav.v1`:

```json
{
  "stack": [
    { "id": "note-a", "source": "panel" },
    { "id": "note-b", "source": "wiki" },
    { "id": "note-c", "source": "cosmos" }
  ],
  "index": 2
}
```

- **Not** written to `localStorage` — cleared when browser session ends.
- Hydrated on module load via `loadPersistedStack()`.
- Every `notify()` writes latest state.

### Entry model

Each stack entry stores:
- `id` — note id
- `source` — `wiki | relation | backlink | cosmos | search | panel | external | schedule | health`

### Seed behavior change

`seedNoteNavigationStack(null)` no longer clears the stack — closing the mobile editor preserves history.

### Editor close / reopen

1. User explores A → B → C.
2. Mobile back to list (`setMobileShowEditor(false)`).
3. Reopen note — stack still A,B,C at C.
4. Back/forward buttons and Alt+arrows still work.

## API additions

| Function | Purpose |
|----------|---------|
| `getNoteNavigationStack()` | Read entries (debug/docs) |
| `getCurrentNavigationEntry()` | Current `{ id, source }` |

## Tests

`noteNavigationStack.test.ts` — persistence payload, null-seed preservation.
