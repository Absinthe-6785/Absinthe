# K-59 Sidebar Review

Branch: `k59-architecture-closure`  
Date: 2026-06-15

## Change summary

Sidebar JSX remains in `NoteViewSidebar.tsx` (K-58). K-59 moves prop **assembly** from `NoteView.tsx` into hooks.

## Prop flow

```
NoteView
  └─ useNoteViewChildPropInput(useMemo(...))
       └─ buildNoteViewChildPropSources
            └─ useNoteViewChildProps
                 └─ useNoteViewSidebarProps → { layout, data, handlers }
                      └─ <NoteViewSidebar {...sidebarProps} />
```

## Hook contract

`useNoteViewSidebarProps(input)` accepts a flat merge of:
- `NoteViewSidebarLayout` (10 fields)
- `NoteViewSidebarData` (~70 fields)
- `NoteViewSidebarHandlers` (~90 fields)

Returns memoized `{ layout, data, handlers }` matching `NoteViewSidebarProps`.

## NoteView input groups (compact)

In `NoteView.tsx`, child prop input uses three multi-line object literals:
- `sidebarLayout` — visibility/responsive chrome
- `sidebarData` — read-only state (notes, trace, workspace, dashboard)
- `sidebarHandlers` — callbacks from workspace + actions hooks

## Parity

- No changes to `NoteViewSidebar.tsx` component body
- Handler references identical to K-58 inline assembly
- Drag/drop, trace lenses, workspace sections unchanged

## File size

| File | Lines |
|------|------:|
| `NoteViewSidebar.tsx` | 1,040 |
| `useNoteViewSidebarProps.ts` | 446 |

The props hook is large because it memoizes the full flat input dependency list — intentional for referential stability.
