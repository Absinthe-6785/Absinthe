# Knowledge-19.4 — Focus Mode & Quick Capture Pre-Implementation Report

## Scope

Productivity workflow layer on top of K-19.3 dashboard and workspace activation. No new content models, workspace kinds, or note types.

## Foundation (K-19.0–19.3)

| Primitive | Role |
| --------- | ---- |
| `WorkspaceActivation` | Single source of truth for active workspace (unchanged) |
| `WorkspaceRef` | Sidebar/dashboard identity for saved-view, smart-collection, rule-collection, database-view |
| `WorkspaceDashboardView` | Static widget host — extended with Focus Presets + Quick Capture |
| `useNoteWorkspace()` | Activation, preferences, session — extended with focus + capture handlers |
| Note + tags | All captured content remains ordinary notes |

## K-19.4 design

```
FocusPreset (persisted: focus-presets-v1)
  ├─ workspace: WorkspaceRef target
  └─ UI flags: hideSidebar, hideSecondaryPanels, hideGraph

FocusSessionState (ephemeral)
  ├─ activePresetId
  └─ startedAt

Activation flow:
  Dashboard → Start preset
    → save prior WorkspaceActivation
    → activate preset.workspace (existing handleActivateWorkspaceRef)
    → set FocusSessionState
    → NoteView applies UI flags

Exit flow:
  Exit preset → restore prior activation → clear FocusSessionState

QuickCaptureModel (convention only)
  ├─ default: tag:inbox
  └─ types: note | idea | vocabulary | task | research
       → createInboxNote() + optional type tag
       → ordinary note via existing store APIs
```

Focus Mode is **workspace preset + UI state** — not a workspace kind, database view, or note.

Quick Capture is **ordinary notes with tag conventions** — not a capture database or task entity.

## NoteView integration

Existing `focusMode` (Ctrl+F) remains for manual chrome reduction. Focus preset flags apply when `FocusSessionState.activePresetId` is set:

- `hideSidebar` → hide left sidebar
- `hideSecondaryPanels` → collapse note list + hide right panel
- `hideGraph` → force editor mode when graph would show

## Out of scope

Pomodoro, timers, notifications, task engine, daily notes, journaling, dashboard customization, capture database.
