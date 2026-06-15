# K-65 Note Navigation Stack

## Problem

Exploring notes via wiki links, relations, backlinks, Cosmos, and search had no consistent way to return to the previous note.

## Solution

Browser-style history stack scoped to the Notes tab.

### Core module

`frontend/src/lib/noteNavigationStack.ts`

| API | Purpose |
|-----|---------|
| `seedNoteNavigationStack(id)` | Initialize stack on hydrate (no push) |
| `pushNoteNavigation(id, source)` | Append entry (truncates forward history) |
| `navigateToNoteWithHistory(id, source)` | Push + `setActiveNoteId` |
| `goBackNote()` / `goForwardNote()` | Navigate with `fromHistory` flag (no re-push) |
| `getNoteNavigationSnapshot()` | `{ canBack, canForward }` |
| `subscribeNoteNavigationStack` | External store subscription |

**Sources tracked:** `wiki | relation | backlink | cosmos | search | panel | external`

**Limits:** Max 50 entries; duplicate consecutive IDs skipped.

### React integration

- `useNoteNavigationStack` — `useSyncExternalStore` hook
- `NoteView.tsx` — seeds stack on `activeNoteId`; `openNoteById(id, source)` wrapper
- `NoteViewEditorArea` — header back/forward buttons; mobile back uses history when `canBack`
- `useNoteKeyboardActions` — Alt+← back, Alt+→ forward
- `openNote()` in `noteNavigation.ts` — external opens use `external` source

### Wired entry points

| Surface | Source |
|---------|--------|
| Wiki links (`navigateToWiki`) | `wiki` |
| Workspace search palette | `search` |
| Cosmos `onSelect` | `cosmos` |
| Context panel backlinks | `backlink` |
| Context panel relations | `relation` |
| Other context panel navigation | `panel` |
| Sidebar note list click | `panel` |
| `openNote()` global helper | `external` |

### UI

- **Desktop:** ChevronLeft / ChevronRight in editor header when history exists
- **Mobile:** Single back button — history back if available, else close editor
- **Keyboard:** Alt+ArrowLeft / Alt+ArrowRight

### i18n

- `nvBackToPreviousNote`
- `nvForwardNote`

## Non-goals (K-65)

- Cross-tab history (Schedule → Note)
- URL/deep-link sync
- Persisting stack across sessions
