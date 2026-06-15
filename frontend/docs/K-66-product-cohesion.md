# K-66 Product Cohesion

## Goal

Make Absinthe feel like one connected system — not adjacent workspaces.

## K-66 scope

| Priority | Deliverable | Status |
|----------|-------------|--------|
| P1 | Session-persistent note navigation stack | Done |
| P2 | Cross-workspace deep links + return paths | Done |
| P3 | Search entry point discoverability | Done |
| P4 | Empty-state completion | Partial (graph search, existing panels) |
| P5 | Toast / feedback i18n | Partial |
| P6 | Cohesion audit | Documented |

## Architecture (no new subsystems)

```
sessionStorage
  ├─ absinthe.noteNav.v1      → stack + index + per-entry source
  └─ absinthe.noteNav.returnTab → planner | health | …

noteNavigationStack.ts  — in-memory + session persist
noteNavigation.ts       — openNote(), returnFromNote(), registerAppTabSwitcher
useNoteReturnTab.ts     — React subscription for return chip
```

## User-facing cohesion wins

1. **Navigation survives** editor close, tab switch, and page refresh (same browser session).
2. **Schedule / Health → Notes** opens with return affordance in editor header.
3. **Workspace search** discoverable on mobile note list (search icon + Ctrl+K hint).
4. **Graph search miss** offers clear-query action.

## Friction remaining (K-67)

- Archive tab note opens lack return-tab metadata
- No universal breadcrumb across Cosmos / Timeline / Discover suites
- Health nutrition/recovery lack dedicated note shortcuts (workout day log added)

## Related docs

- `K-66-navigation-continuity.md`
- `K-66-cross-workspace-links.md`
- `K-66-search-discoverability.md`
- `K-66-feedback-consistency.md`
- `K-66-validation-checklist.md`
