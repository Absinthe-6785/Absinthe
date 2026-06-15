# K-58 Actions Architecture

Branch: `k58-noteview-final-decomposition`  
Date: 2026-06-15

## Overview

`useNoteViewActions.ts` refactored from a 979-line monolith into an **82-line facade** composing four domain hooks under `noteview/actions/`.

## Before / after

| File | Before | After |
|------|--------|-------|
| `useNoteViewActions.ts` | 979 | **83** |
| `actions/useNoteCrudActions.ts` | — | 422 |
| `actions/useNoteImportExportActions.ts` | — | 112 |
| `actions/useNoteTraceActions.ts` | — | 300 |
| `actions/useNoteKeyboardActions.ts` | — | 132 |
| `actions/types.ts` | — | 75 |

Public API: **63 handlers** — identical names and signatures to K-57.

## Composition

```
useNoteViewActions(params)
├── useNoteCrudActions(params)
│   └── returns: noteUpdate, createNote, CRUD, project/milestone create,
│       title/body, graph expand/collapse, area toggle, reading source
├── useNoteImportExportActions(params)
│   └── returns: export/import, copy document, editor drop, image insert
├── useNoteTraceActions(params, crud.openCreatedNote)
│   └── returns: trace lenses, event/milestone dialogs, workspace nav,
│       handleActivateDashboardWithTraceClear
└── useNoteKeyboardActions(params, crud.createNote, crud.duplicateNote)
    └── returns: navigateToWiki (+ keyboard useEffect side effect)
```

## Hook responsibilities

### `useNoteCrudActions`

Note and folder CRUD, title/body updates, quick capture, task/journal creation, reading/study note creation, project/milestone dialog submit handlers, project/milestone property updates, learning path step notes, graph node expand/collapse, area note toggle, reading source link/unlink, `addFolder`, `openCreatedNote`.

### `useNoteImportExportActions`

`exportNote`, `exportAllNotes`, `handleImport`, `handleCopyDocument`, `handleEditorDrop`, `insertImageAtCursor`, `insertEmptyImageBlockAtCursor`.

### `useNoteTraceActions`

Trace navigation (`openTraceDay/Range/Area/Discovery`, `closeTraceLens`), event/milestone dialogs and saves, `registerTraceNavigation` effect, `handleActivateDashboardWithTraceClear`, workspace search/collection navigation handlers.

### `useNoteKeyboardActions`

Global `keydown` handler (`Ctrl+N`, `Ctrl+S`, `Ctrl+K`, etc.) and `navigateToWiki`.

## Cross-hook dependencies

| Dependency | Flow |
|------------|------|
| `openCreatedNote` | crud → trace (event dialog create flow) |
| `createNote`, `duplicateNote` | crud → keyboard (shortcuts, wiki nav) |
| `openCreateEventDialogRef` | trace sets ref; crud `createQuickCapture` reads it |

## Types

`UseNoteViewActionsParams` moved to `actions/types.ts`. Re-exported from `useNoteViewActions.ts` and `actions/index.ts` for backward-compatible imports.

## Remaining debt

`useNoteCrudActions.ts` at **419 lines** exceeds the 400-line target by 19 lines. K-59 will extract project/milestone property update handlers.

## Related

- [K-58-noteview-final-decomposition.md](./K-58-noteview-final-decomposition.md)
- [K-58-validation-checklist.md](./K-58-validation-checklist.md)
