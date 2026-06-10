# Knowledge-19.2 — Workspace Preferences Pre-Implementation Report

## Scope

Preference layer for pins, recents, and session restore. No dashboard, focus mode, daily notes, or inbox.

## K-19.1 foundation

| Component | Role |
| --------- | ---- |
| `WorkspaceActivation` | Single active selection (unchanged) |
| `WorkspaceRef` / `WorkspaceItemRef` | Sidebar identity |
| `WorkspaceSessionState` | Last activation in `note-workspace-session-v1` |
| `useNoteWorkspace()` | Owns activation, CRUD, filtering |

## K-19.2 design

```
WorkspacePreferences (workspace-prefs-v1)
  pinned: WorkspaceRef[]
  recent: RecentWorkEntry[]

WorkspaceSessionState (note-workspace-session-v1) — unchanged
  activation + updatedAt
```

Preferences reference existing workspace items by `{ kind, id }` — no new entity types.

| Feature | Storage | Trigger |
| ------- | ------- | ------- |
| Pinned workspaces | `workspace-prefs-v1.pinned` | User pin/unpin/reorder |
| Recent work | `workspace-prefs-v1.recent` | User activation (not notes) |
| Session restore | `note-workspace-session-v1` | Startup via `restoreWorkspaceActivation()` |

## Resolution

`resolveWorkspaceRef()` validates refs against loaded saved views, rule collections, database views, and smart collections. Invalid refs are pruned silently.

## UI

- `PinnedWorkspacesSection` — activate, unpin, reorder
- `RecentWorkSection` — activate, pin, clear history
- Optional pin toggle on existing workspace section rows

## Out of scope

Dashboard, focus mode, note-level recents, preference export/import.
