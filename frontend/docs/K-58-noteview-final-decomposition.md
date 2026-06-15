# K-58 NoteView Final Decomposition

Branch: `k58-noteview-final-decomposition`  
Date: 2026-06-15

## Summary

K-58 completes the NoteView decomposition started in K-57: sidebar and editor JSX move into dedicated components, action handlers split into four domain hooks, context panel props grouped, and knowledge cosmos/database deep imports migrated to `@/` aliases.

| Metric | Before (K-57) | After (K-58) | Δ |
|--------|---------------|--------------|---|
| `NoteView.tsx` lines | 2,770 | **1,809** | **−961 (−35%)** |
| `useNoteViewActions.ts` | 979 | **82** (facade) |
| `NoteContextPanelBody.tsx` flat props | ~80 | **5 grouped interfaces** | structured |
| Deep imports (`../../../../../../`) in `src/` | 17 | **0** (1 test-only retained) | −17 |
| `typecheck` | PASS | PASS | — |
| `build` | PASS | PASS | — |
| `test` | 1897 PASS | **1897 PASS** | — |

## Module layout

```
src/components/views/
├── NoteView.tsx                         # Orchestrator (~1,809 lines)
└── noteview/
    ├── index.ts                         # Barrel exports
    ├── NoteViewSidebar.tsx              # Left nav + note list column
    ├── NoteViewEditorArea.tsx           # NoteBlockEditor + editor main area
    ├── NoteContextPanelBody.tsx         # Grouped context panel props
    ├── useNoteViewState.ts
    ├── useNoteViewDashboard.ts
    ├── useNoteViewPanels.ts
    ├── useNoteViewActions.ts            # Facade composing action sub-hooks
    └── actions/
        ├── index.ts
        ├── types.ts
        ├── useNoteCrudActions.ts
        ├── useNoteImportExportActions.ts
        ├── useNoteTraceActions.ts
        └── useNoteKeyboardActions.ts
```

## Extractions (K-58)

| Module | Lines | Responsibility |
|--------|-------|----------------|
| `NoteViewSidebar.tsx` | 1,041 | Folder tree, trace nav, workspace sections, tags, collapsed icon bar, note list header/sort/trace views/dashboard/database/note rows |
| `NoteViewEditorArea.tsx` | 701 | `NoteBlockEditor` adapter, note header, tags strip, context strip, graph-in-editor, toolbar, appearance panel, block editor body, empty states |
| `actions/useNoteCrudActions.ts` | 422 | Note/folder CRUD, title/body, project/milestone creation, graph expand/collapse, area toggle, reading source |
| `actions/useNoteImportExportActions.ts` | 112 | Export/import, copy document, editor drop, image insertion |
| `actions/useNoteTraceActions.ts` | 300 | Trace lenses, event/milestone dialogs, workspace navigation handlers, `registerTraceNavigation` |
| `actions/useNoteKeyboardActions.ts` | 132 | Global keyboard shortcuts, wiki navigation |

## Related docs

- [K-58-sidebar-extraction.md](./K-58-sidebar-extraction.md)
- [K-58-editor-area-extraction.md](./K-58-editor-area-extraction.md)
- [K-58-actions-architecture.md](./K-58-actions-architecture.md)
- [K-58-import-audit.md](./K-58-import-audit.md)
- [K-58-validation-checklist.md](./K-58-validation-checklist.md)

## Remaining debt

| Item | Status | K-59 target |
|------|--------|-------------|
| `useNoteCrudActions.ts` at 419 lines (target &lt;400) | Minor | Split project/milestone update handlers |
| `NoteViewSidebar.tsx` prop wiring in `NoteView.tsx` (~200 lines) | Acceptable | `useNoteViewSidebarProps` memo hook |
| Inline CSS `useMemo` in `NoteView.tsx` (~100 lines) | Deferred K-57 | `useNoteViewStyles.ts` |
| `copyListener.test.ts` deep import | Test-only, skipped | Migrate in test hygiene pass |

## K-59 roadmap

1. Extract `useNoteViewStyles.ts` (inline theme CSS from `NoteView.tsx`)
2. Extract `useNoteViewSidebarProps` / `useNoteViewEditorProps` to shrink orchestrator wiring
3. Trim `useNoteCrudActions` below 400 lines (project editor handlers sub-hook)
4. Target `NoteView.tsx` under **1,500 lines**
