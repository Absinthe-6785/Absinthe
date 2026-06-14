# K-56 NoteView Audit

## Before

| Property | Value |
|----------|-------|
| Path | `src/components/views/NoteView.tsx` |
| Lines | **3,936** |
| Rank | #1 largest file in `src/` |

### Responsibilities (monolithic)

- Store selectors + note CRUD
- 35+ `useState` hooks (folder, search, panels, trace, mobile)
- `useNoteWorkspace` integration (already extracted)
- Trace lens projections
- Dashboard/history/timeline data builders
- Context panel orchestration (Links, Insights, Actions, Discover, Timeline)
- Main render: sidebar, editor, graph, workspace dashboard
- Inline CSS generation (~150 lines)

## After

| Property | Value |
|----------|-------|
| Lines | **3,433** |
| Reduction | **−503 lines** |

### Extracted hooks (`src/components/views/noteview/`)

| Hook | Responsibility | ~Lines |
|------|----------------|--------|
| `useNoteViewState.ts` | Local UI state, trace/dialog state, `resetBrowseScope` | ~180 |
| `useNoteViewDashboard.ts` | History subscription, discovery feed, timeline/evolution memos, export handlers | ~200 |
| `useNoteViewPanels.ts` | `openContextPanel`, cosmos/link panel handlers, panel derivations | ~150 |

Import path: `'./noteview/index'` (avoids case collision with `NoteView.tsx` on Windows).

### Still in NoteView (K-57 targets)

| Section | Lines (approx.) | Extraction candidate |
|---------|-----------------|----------------------|
| Context panel JSX | ~350 | `NoteContextPanelBody.tsx` |
| Note CRUD + import handlers | ~300 | `useNoteViewActions.ts` |
| Main sidebar render | ~400 | `NoteViewSidebar.tsx` |
| Editor area render | ~500 | `NoteViewEditorArea.tsx` |
| Inline CSS `useMemo` | ~150 | `useNoteViewStyles.ts` |

### Existing extractions (pre-K-56)

- `NoteBlockEditor` adapter (forwardRef wrapper)
- `useNoteWorkspace` (896 lines)
- `KnowledgeContextPanel` shell component

## Coupling notes

- `useNoteViewPanels` depends on `activeNote`, `notes`, `blockEditorRef`, store setters
- `useNoteViewDashboard` depends on `timelineMode`, `lang`, `notes`
- No circular imports introduced; hooks import from `features/knowledge` directly
