# Knowledge-19.1 — Workspace Hygiene Pre-Implementation Report

## Scope

Infrastructure cleanup only. No dashboard, daily notes, inbox, focus, pins, or recents UI.

## Current state (post K-19.0)

| Area | Status |
| ---- | ------ |
| `WorkspaceActivation` | Single discriminated union in NoteView — correct model |
| `handleDeleteSavedView` | **Bug** — calls removed `setActiveSavedViewId` |
| Workspace logic | ~150 lines inline in NoteView |
| Session restore | Not persisted |
| `WorkspaceItemRef` | Defined, unused |
| Filter dispatch | `applyWorkspaceListFilter` handles smart/rule; saved-view via search; database via panel |

## Resolution paths (unchanged behavior)

| Kind | List filter | Notes |
| ---- | ----------- | ----- |
| `saved-view` | `search-query` | `filterNotes` on search input |
| `smart-collection` | `index-evaluator` | `applyWorkspaceListFilter` |
| `rule-collection` | `query-rule` | `applyWorkspaceListFilter` |
| `database-view` | `query-rule` | `DatabaseViewPanel` vault-wide |

## K-19.1 plan

1. Fix saved-view delete activation clearing
2. Extract `useNoteWorkspace()` hook
3. Add `getWorkspaceFilterSource()` for consistent resolution metadata
4. Add `WorkspaceSessionState` + storage (save only; no auto-restore UI)
5. Extend `workspaceModels` with type guards and normalization
6. Slim NoteView to orchestration

## Out of scope

Folder/workspace navigation inconsistencies (deferred), auto-restore on load (K-19.2).
