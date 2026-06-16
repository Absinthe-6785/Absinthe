# K-89A Search Integrity Report

## Root cause — Find-in-Note Backspace deletes note content

**Symptom:** User focuses Find-in-Note, selects a match, types or presses Backspace, and note body text is deleted.

**Cause:** `BlockEditor` search navigation `useEffect` called `requestFocus()` on every `searchQuery` change. That moved DOM focus from the toolbar search `<input>` into the matching `contenteditable` block. Subsequent Backspace was handled by `EditableBlock` (merge/delete), not the search field.

**Secondary leak:** `NoteBlockEditor` registered a capture-phase `Ctrl+Z` / `Ctrl+Y` handler without checking whether focus was in a form control, so undo/redo could run from the search input.

## Focus ownership rules

| Surface | Attribute / selector | Owns focus for |
|---------|---------------------|----------------|
| Find in Note | `data-editor-document-search` | Query text, match navigation keys |
| Sidebar list filter | `data-sidebar-note-search` | Note list plain-text / query filter |
| Global Search | `WorkspaceSearchPalette` modal trap | Workspace navigation |
| Metadata / settings | `input`, `textarea`, `select` | Field editing |
| Block editor | `.be-editable[contenteditable]` | Note body editing |

**Rule:** When `isFocusInFormControl()` is true, editor shortcuts (Backspace block delete, Enter-on-selection, undo/redo) must not run.

Implementation: `frontend/src/components/views/searchFocusIsolation.ts`

## Keyboard routing (after fix)

| Key | Find-in-Note focused | Editor focused |
|-----|---------------------|----------------|
| Backspace / Delete | Edits query only | Block/text editing |
| Arrows | Caret in query | Block navigation / caret |
| Enter | Next match | New line / block ops |
| Shift+Enter | Previous match | — |
| Escape | Clear query or blur | Clear selection |
| Ctrl+A | Select query text | Document or block select-all |
| Ctrl+Z / Ctrl+Y | Browser input undo | Note undo/redo |

Search match highlighting still updates while typing; `requestFocus` runs only when the search input is **not** focused (explicit prev/next navigation).

## Regression tests

- `searchFocusIsolation.test.ts`
- `findInNoteKeyboard.integration.test.ts`
- `sidebarNoteListFilter.test.ts`
