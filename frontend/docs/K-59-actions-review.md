# K-59 Actions Review

Branch: `k59-architecture-closure`  
Date: 2026-06-15

## Before / after

| File | Before | After |
|------|--------|-------|
| `useNoteCrudActions.ts` | 419 | **283** |
| `useNoteProjectActions.ts` | — | 73 |
| `useNoteMilestoneActions.ts` | — | 87 |
| `useNoteReadingActions.ts` | — | 89 |

## Split boundaries

### `useNoteProjectActions`
- `handleCreateProject`
- `handleSubmitCreateProject`
- `handleUpdateProjectDescription`
- `handleUpdateProjectStatus`

### `useNoteMilestoneActions`
- `handleCreateProjectMilestone`
- `handleSubmitCreateMilestone`
- `handleUpdateMilestoneStatus`
- `handleUpdateMilestoneTargetDate`

### `useNoteReadingActions`
- `handleCreateReadingNote`
- `handleCreateStudyNote`
- `handleLinkReadingSource`
- `handleUnlinkReadingSource`

### `useNoteCrudActions` (facade)
Spreads `{ ...projectActions, ...milestoneActions, ...readingActions }` plus core CRUD, capture, graph, folder, and area handlers.

## Unchanged facades

- `useNoteViewActions.ts` — still the single entry point for NoteView
- `actions/index.ts` — exports new sub-hooks for testing/reuse

## Action hook sizes (noteview/actions/)

| Hook | Lines |
|------|------:|
| `useNoteTraceActions.ts` | 304 |
| `useNoteCrudActions.ts` | 283 |
| `useNoteKeyboardActions.ts` | 132 |
| `useNoteImportExportActions.ts` | 112 |
| `useNoteReadingActions.ts` | 89 |
| `useNoteMilestoneActions.ts` | 87 |
| `useNoteProjectActions.ts` | 73 |

## Coupling notes

- Project/milestone actions use `useNotesStore.getState()` for post-create reads (unchanged from K-58)
- Sub-hooks share `NoteUpdateFn` / `OpenCreatedNote` types from `actions/types.ts`
- No new cross-imports into knowledge feature internals
