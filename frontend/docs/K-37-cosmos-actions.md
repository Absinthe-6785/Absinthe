# K-37 Cosmos Actions

Turn K-36 diagnostics into one-click knowledge actions.

## Actions tab

The **Actions** tab in the Knowledge Context panel (`CosmosActionsPanel`) is the primary action surface:

- **Recommended actions** — prioritized checklist (assign area, create hub, add relation, resolve isolated)
- **Knowledge opportunities** — Connect / View candidates / Assign buttons
- **Area guidance** — health summary + recommendations when an area is fragmented
- **Suggested connections** — enriched reasons + Create relation / Open

## Mutations

All actions apply deterministic local patches via `noteMutations.ts`:

| Action | Patch |
|--------|--------|
| Connect | Append `[[target]]` wiki link to body |
| Assign area | Set `area` property + optional wiki link to area note |
| Create hub | New note from template + `type: area` property |
| Create relation | `related-to` relation target |
| Link (Related notes) | Append wiki link |

No AI, embeddings, or external APIs.

## HUD & search

- Graph HUD: **Review** (weak areas) opens Actions on a note in the weakest area; **Open** reveals isolated nodes
- Workspace search: notes with pending actions show **Actions available**

## Module layout

```
cosmos/actions/
  actionEngine.ts      — plan builder (reuses K-36 intelligence)
  noteMutations.ts     — deterministic note patches
  CosmosActionsPanel.tsx
  OpportunityActions.tsx
  AreaGuidance.tsx
  HubCreationAssistant.tsx
  ConnectionRecommendationCard.tsx
```
