# K-59 NoteView Final Audit

Branch: `k59-architecture-closure`  
Date: 2026-06-15

## Line counts

| File | Lines |
|------|------:|
| `NoteView.tsx` | **1,426** |
| `noteview/NoteViewSidebar.tsx` | 1,040 |
| `noteview/NoteViewEditorArea.tsx` | 700 |
| `noteview/NoteContextPanelBody.tsx` | 608 |
| `noteview/useNoteViewSidebarProps.ts` | 446 |
| `noteview/useNoteViewStyles.ts` | 105 |
| `noteview/useNoteViewChildProps.ts` | 62 |
| `noteview/useNoteViewChildPropInput.ts` | 40 |
| `noteview/buildNoteViewChildPropSources.ts` | 48 |

## NoteView responsibilities (remaining)

- Store selectors and local UI state (`useNoteViewState`)
- Workspace hook wiring (`useNoteWorkspace`)
- Derived note/trace/dashboard memos
- TOC scroll-spy and keyboard navigation
- Action facade (`useNoteViewActions`)
- Child prop input assembly (`useNoteViewChildPropInput` + `useNoteViewChildProps`)
- Modal/dialog orchestration (events, milestones, projects, confirm, workspace search)
- Root layout JSX (overlays, skip links, context panel shell)

## Extracted in K-59

| Concern | Module |
|---------|--------|
| CSS generation | `useNoteViewStyles.ts` |
| Sidebar props | `useNoteViewSidebarProps.ts` |
| Editor props | `useNoteViewEditorAreaProps.ts` |
| Context panel props | `useNoteContextPanelProps.ts` |
| Combined child props | `useNoteViewChildProps.ts` |
| Panel tab config | `useNoteViewPanelConfig.tsx` |
| Shortcuts modal | `NoteViewShortcutsModal.tsx` |

## Success criteria

| Criterion | Target | Actual |
|-----------|--------|--------|
| `NoteView.tsx` | ≤ 1,500 | **1,426** ✅ |
| No behavior change | — | verified by 1897 tests |
| No visual change | — | CSS string identical |

## Top frontend files (context)

After K-59, `NoteView.tsx` drops from #3 to **#4** largest file in `frontend/src`:

1. `lib/i18n.ts` — 1,546
2. `NoteGraphView.tsx` — 1,512
3. `HealthView.tsx` — 1,508
4. **`NoteView.tsx` — 1,426**
