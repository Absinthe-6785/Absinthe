# K-57 NoteView Decomposition

Branch: `k57-noteview-knowledge-refactor`  
Date: 2026-06-15

## Summary

K-57 completes the NoteView extractions planned in K-56: context panel JSX and note CRUD/action handlers move into dedicated modules under `noteview/`, leaving `NoteView.tsx` as a thinner orchestrator.

| Metric | Before (K-56 end) | After (K-57) | Δ |
|--------|-------------------|--------------|---|
| `NoteView.tsx` lines | 3,433 | 2,770 | **−663 (−19%)** |
| `noteview/` module lines | ~530 (3 hooks) | **2,186** (5 hooks + panel body) | +1,656 extracted |
| `typecheck` | PASS | PASS | — |

## Module layout

```
src/components/views/
├── NoteView.tsx                    # Orchestrator: sidebar, editor shell, wiring
└── noteview/
    ├── index.ts                    # Public barrel (5 hooks + panel body)
    ├── useNoteViewState.ts         # Local UI state, trace/dialog state
    ├── useNoteViewDashboard.ts     # History, discovery, timeline, export memos
    ├── useNoteViewPanels.ts        # Context panel open/handlers, derivations
    ├── useNoteViewActions.ts       # Note CRUD, import, keyboard, trace handlers
    └── NoteContextPanelBody.tsx    # Right-panel tab JSX (Links → Timeline)
```

Import path: `'./noteview/index'` (avoids case collision with `NoteView.tsx` on Windows).

## Extractions (K-57)

| Module | Lines | Responsibility |
|--------|-------|----------------|
| `NoteContextPanelBody.tsx` | 582 | Renders all context-panel tabs: TOC, links, graph, insights, actions, discover, timeline, properties, tags, relations, project/milestone editors |
| `useNoteViewActions.ts` | 979 | Note/folder CRUD, drag-drop import, keyboard shortcuts, trace/event/milestone dialogs, workspace quick-capture, graph expand/collapse, wiki navigation |

## Still in NoteView (K-58 targets)

| Section | Lines (approx.) | Extraction candidate |
|---------|-----------------|----------------------|
| Main sidebar render | ~400 | `NoteViewSidebar.tsx` |
| Editor area render | ~500 | `NoteViewEditorArea.tsx` |
| Inline CSS `useMemo` | ~150 | `useNoteViewStyles.ts` |
| Store selectors + wiring | ~300 | Further hook split if needed |

Target: **&lt; 2,500 lines** — achieved at **2,770** (partial; sidebar/editor split deferred to K-58).

## Coupling notes

- `NoteContextPanelBody` receives ~80 props — intentional flat contract to avoid re-introducing store coupling inside the panel
- `useNoteViewActions` imports from `features/knowledge` barrel (one-way; no circular deps)
- Panel-specific types still imported from deep paths where needed (e.g. `KnowledgeContextTab` from `KnowledgeContextPanel`)

## Related docs

- [K-57-context-panel-architecture.md](./K-57-context-panel-architecture.md)
- [K-57-knowledge-module-review.md](./K-57-knowledge-module-review.md)
- [K-57-validation-checklist.md](./K-57-validation-checklist.md)

## K-58 roadmap

1. Extract `NoteViewSidebar.tsx` and `NoteViewEditorArea.tsx`
2. Extract `useNoteViewStyles.ts` (inline theme CSS)
3. Reduce `NoteContextPanelBody` prop surface via grouped context objects
4. Target `NoteView.tsx` under **2,000 lines**
