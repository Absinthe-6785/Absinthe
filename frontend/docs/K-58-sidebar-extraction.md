# K-58 Sidebar Extraction

Branch: `k58-noteview-final-decomposition`  
Date: 2026-06-15

## Overview

`NoteViewSidebar.tsx` extracts the left navigation sidebar and note list column from `NoteView.tsx`. The component renders two sibling regions wrapped in a fragment:

1. **Left sidebar** (`#noteview-navigation`) — folder tree, trace lenses, workspace sections, tags, collapsed icon bar
2. **Note list column** (`#noteview-note-list`) — header, sort menu, trace views, dashboard, database view, note list items

## Before / after

| Metric | Before | After |
|--------|--------|-------|
| Sidebar + list JSX in `NoteView.tsx` | ~729 lines (1414–2142) | 0 (delegated) |
| `NoteViewSidebar.tsx` | — | **1,040 lines** |
| `NoteView.tsx` total | 2,770 | 1,809 |

## Props contract

```ts
interface NoteViewSidebarProps {
  layout: NoteViewSidebarLayout;   // hideLeftChrome, isMobile, sidebarCollapsed, etc.
  data: NoteViewSidebarData;       // colors, notes, folders, trace state, workspace data
  handlers: NoteViewSidebarHandlers; // CRUD, trace, workspace activation callbacks
}
```

### Layout group

Visibility and responsive chrome: `hideLeftChrome`, `hideSecondaryChrome`, `hideNoteList`, `isMobile`, `isTablet`, `isCompactChrome`, `isWorkspacePanelMode`, `sidebarCollapsed`, `mobileSidebarOpen`.

### Data group

Read-only state: `c` (colors), `notes`, `folders`, trace projections, workspace activation, visible notes, counts, labels.

### Handlers group

Callbacks: folder CRUD, trace navigation, workspace activation, note selection, sort, import/export triggers, dashboard quick actions.

## Boundary

- **Stays in `NoteView`**: store selectors, derived memos, workspace hook, action hooks
- **Moved to sidebar**: all JSX for nav + note list
- **Not included**: `NoteBlockEditor`, editor header, context panel (P2/P4)

## Verification

- Visual parity: no CSS/class changes
- Behavior parity: all click/drag/drop handlers passed through unchanged
- `npm run typecheck:app` PASS

## Related

- [K-58-noteview-final-decomposition.md](./K-58-noteview-final-decomposition.md)
- [K-58-editor-area-extraction.md](./K-58-editor-area-extraction.md)
