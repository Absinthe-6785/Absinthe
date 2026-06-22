# K-125A — Notes Workspace Polish

Improve visual cohesion of the Notes workspace header and empty states without
changing editor behavior, search logic, or storage.

## Changes

- Merge **New Note** into the per-note actions row when a note is open (alongside
  find-in-note, star, copy, and panel controls).
- Show the standalone top action bar only when no note is selected (and vault is
  not empty) — removes duplicate New Note on empty vault.
- Normalize header padding, gaps, and button sizes via `k125a-*` CSS classes in
  `useNoteViewStyles.ts` (reuses `UI_INTERACTION` tokens).
- Group search and icon actions in `k125a-notes-actions-cluster`.
- Compact empty vault / select-note shells with `k125a-notes-empty-shell`.

## Out of scope

- BlockEditor, FindInNotePanel, NoteView visibility logic
- Global workspace search in header (K-122 IA preserved)
- Storage, hydration, providers

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm test -- k125a k121 k117 k122 k108a k119 findInNoteKeyboard gutterDrag
```
