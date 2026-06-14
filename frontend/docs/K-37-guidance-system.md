# K-37 Guidance System

Area-level guidance derives from K-36 `areaHealth` and `knowledgeGaps` — no separate scoring.

## Area guidance

When the active note belongs to an area (`snapshot.areaHealth`), `buildCosmosActionPlan` builds an `AreaGuidanceItem`:

- Label and health score / category (Healthy → Critical)
- Recommendations mapped from gaps:
  - `missing-hub` → Create a hub note
  - `missing-milestone` → Add milestones
  - `isolated-cluster` / `weak-linking` → Connect isolated notes
- Fallback: fragmented/critical areas without explicit gaps still recommend connecting isolated notes

## Hub assistant

When `missing-hub` gap is present, `HubAssistantState` suggests `{AreaLabel} Hub` with the standard template body (`# Overview`, `## Timeline`, etc.).

## Area assignment

`suggestAreaForNote` scores uncategorized notes against existing area health rows using:

- Shared tags with area members
- Title token overlap
- Area label match
- Area health score (weak areas deprioritized slightly via weight)

Confidence ≥ 40% surfaces a suggested assignment with **Assign** button.

## UI components

- `AreaGuidance.tsx` — health line + recommendation list + suggested area card
- `HubCreationAssistant.tsx` — hub creation CTA with template preview
