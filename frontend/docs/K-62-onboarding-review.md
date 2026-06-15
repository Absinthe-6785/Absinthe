# K-62 — Onboarding & Discoverability Review

Approach: **contextual guidance** only — no tutorial overlays.

## Hints added

| Feature | Hint | Location |
|---------|------|----------|
| Relations | `[[Title]]` linking + side panel | `NoteRelationsPanel` when empty |
| Schedule mobile | Swipe to change day/week | Below calendar period nav |
| Cosmos | Arrow keys + Escape | Graph toolbar when preview open |
| Schedule empty | Add events/routines/tasks | Existing `scheduleDayEmptyHint` |

## Existing discoverability (audited)

| Feature | Status |
|---------|--------|
| Cosmos empty states | K-41 onboarding copy present |
| Editor slash commands | `EditorDiscoverabilityHints` |
| Workspace search | ⌘K palette |
| Timeline | Trace lenses in sidebar |
| Health | Mobile tab headers |

## Recommendations (K-63)

- First graph open: one-line “click to preview” near search (desktop)
- Health: link to routine tab from empty workout state
- Timeline: “Open from sidebar Trace” hint on first workspace visit
