# Knowledge-19.3 — Workspace Dashboard Pre-Implementation Report

## Scope

Static workspace dashboard as a first-class `WorkspaceActivation` kind. No widget editing, layout persistence, or customization.

## Foundation (K-19.0–19.2)

| Layer | Role |
| ----- | ---- |
| `WorkspaceActivation` | Single active selection — extended with `{ kind: 'dashboard' }` |
| `WorkspacePreferences` | Pins + recents (reused by widgets) |
| `WorkspaceSessionState` | Last activation + `resumeActivation` for resume widget |
| `useNoteWorkspace()` | Activation, preferences, session restore |

## K-19.3 design

```
{ kind: 'dashboard' }  →  WorkspaceDashboardView (middle column)
                              ├─ Pinned Workspaces (preferences.pinned)
                              ├─ Recent Work (preferences.recent)
                              ├─ Resume Last (session.resumeActivation)
                              ├─ Recent Notes (notes by updatedAt)
                              └─ Quick Actions (wired to NoteView)
```

Dashboard is a composition layer — no new note/database/query types. Only `WorkspaceActivation` is persisted when dashboard is active; widget layout is fixed in code.

## Default entry

First visit (no session key) opens dashboard. Existing sessions restore per K-19.2, including `{ kind: 'dashboard' }`.

## Out of scope

Widget drag/drop, custom layouts, focus mode, inbox, daily notes, tasks.
