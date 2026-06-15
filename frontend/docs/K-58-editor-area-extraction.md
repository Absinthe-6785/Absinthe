# K-58 Editor Area Extraction

Branch: `k58-noteview-final-decomposition`  
Date: 2026-06-15

## Overview

`NoteViewEditorArea.tsx` extracts the editor main area and the `NoteBlockEditor` block-editor adapter from `NoteView.tsx`.

## Before / after

| Metric | Before | After |
|--------|--------|-------|
| Editor JSX + `NoteBlockEditor` in `NoteView.tsx` | ~524 lines (206–278, 2144–2595) | 0 (delegated) |
| `NoteViewEditorArea.tsx` | — | **697 lines** |
| `NoteView.tsx` total | 2,770 | 1,809 |

## Contents

| Section | Lines (approx.) | Notes |
|---------|-----------------|-------|
| `NoteBlockEditor` adapter | ~73 | `forwardRef` + `useBlockEditor` + undo/redo capture |
| Note header | ~160 | Title, folder, classification, sync status, view modes, actions |
| Tags strip | ~35 | `TagChipRow` with expand/collapse |
| Context strip | ~20 | `NoteContextStrip` |
| Literature workflow | ~10 | `LiteratureWorkflowIndicator` |
| Graph-in-editor | ~15 | `NoteGraphView` when `viewMode === 'graph'` |
| Toolbar | ~130 | Slash hints, search scope, import, appearance panel |
| Block editor body | ~80 | Drop zone, trash preview, `NoteBlockEditor` |
| Empty states | ~25 | No note selected / graph without note |

## Props contract

```ts
interface NoteViewEditorAreaProps {
  layout: NoteViewEditorLayout;   // hideEditorArea, isMobile, isTrash, viewMode, etc.
  data: NoteViewEditorData;       // activeNote, colors, tags, sync state, refs
  handlers: NoteViewEditorHandlers; // title/body change, export, graph HUD, etc.
}
```

## Boundary

- **Stays in `NoteView`**: TOC scroll spy, `useNoteViewPanels` handlers, context panel shell
- **Moved to editor area**: all `<main id="noteview-main">` content
- **Not included**: left sidebar, note list, right context panel, modals/dialogs

## `NoteBlockEditor` placement

Moved into `NoteViewEditorArea.tsx` (not a separate file) because it is only used by the editor area. Parent still passes `key={activeNote.id}` and `ref={blockEditorRef}` from `NoteView`.

## Verification

- Block editor undo/redo capture unchanged (capture phase `keydown`)
- Reading mode click delegation unchanged
- Drag-drop / paste image insertion unchanged
- `npm run typecheck:app` PASS

## Related

- [K-58-noteview-final-decomposition.md](./K-58-noteview-final-decomposition.md)
- [K-58-sidebar-extraction.md](./K-58-sidebar-extraction.md)
