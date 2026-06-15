# K-59 Coupling Audit

Branch: `k59-architecture-closure`  
Date: 2026-06-15

## Largest files in `frontend/src` (top 15)

| Lines | Path |
|------:|------|
| 1,546 | `lib/i18n.ts` |
| 1,512 | `components/views/NoteGraphView.tsx` |
| 1,508 | `components/views/HealthView.tsx` |
| 1,426 | `components/views/NoteView.tsx` |
| 1,065 | `components/views/blockUtils.ts` |
| 1,040 | `components/views/noteview/NoteViewSidebar.tsx` |
| 895 | `components/views/features/knowledge/workspace/useNoteWorkspace.ts` |
| 874 | `components/views/features/knowledge/components/WorkspaceDashboardView.tsx` |
| 822 | `components/views/BlockEditor.tsx` |
| 798 | `components/views/features/knowledge/KnowledgeIndexService.ts` |
| 721 | `components/views/PlannerView.tsx` |
| 700 | `components/views/noteview/NoteViewEditorArea.tsx` |
| 678 | `components/views/noteUtils.ts` |
| 608 | `components/views/noteview/NoteContextPanelBody.tsx` |
| 595 | `store/useNotesStore.ts` |

## Largest noteview hooks

| Lines | Hook |
|------:|------|
| 446 | `useNoteViewSidebarProps.ts` |
| 304 | `actions/useNoteTraceActions.ts` |
| 283 | `actions/useNoteCrudActions.ts` |
| 226 | `useNoteViewPanels.ts` |
| 219 | `useNoteViewEditorAreaProps.ts` |
| 216 | `useNoteViewDashboard.ts` |

## Largest actions/ hooks

| Lines | Hook |
|------:|------|
| 304 | `useNoteTraceActions.ts` |
| 283 | `useNoteCrudActions.ts` |
| 132 | `useNoteKeyboardActions.ts` |
| 112 | `useNoteImportExportActions.ts` |
| 89 | `useNoteReadingActions.ts` |
| 87 | `useNoteMilestoneActions.ts` |
| 73 | `useNoteProjectActions.ts` |

## Deep imports

| Scope | Count |
|-------|------:|
| Production (`src/`, 7-level `../../../../../../`) | **0** |
| Test-only (retained from K-58) | 1 |

## Coupling hotspots

1. **`NoteView.tsx` ↔ `useNoteWorkspace`** — workspace activation, collections, dashboard data (~40 destructured fields)
2. **`useNoteViewSidebarProps` dependency array** — wide flat deps; stable but verbose
3. **`useNoteViewActions` facade** — aggregates 4 action sub-hooks; primary mutation boundary
4. **`KnowledgeIndexService`** — panel data memos in NoteView still call service directly
5. **`useNoteViewChildPropInput`** — single memo bundles sidebar/editor/context; hotspot for future prop additions

## Recommendations (K-60+, not structural)

- Profile re-renders when sidebar props memo busts on large vaults
- Consider workspace context provider if prop drilling grows again
- Do **not** split `NoteViewSidebar.tsx` further without a product driver
