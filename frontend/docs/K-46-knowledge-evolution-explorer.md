# K-46 Knowledge Evolution Explorer

K-46 extends K-44/K-45 history into a deep evolution explorer for areas, journeys, and dashboard insights.

## Architecture

```
NoteView
  ├─ buildAreaEvolutionDetail / buildKnowledgeJourney / buildExpandedCosmosEvolutionStory
  ├─ evolutionDashboardSummary → KnowledgeEvolutionCard (dashboard)
  └─ TimelinePanel
       ├─ AreaEvolutionPanel (area drill-through)
       ├─ KnowledgeJourneyPanel (Milestones tab)
       ├─ BootstrapImportSummaryCard (once, dismissible)
       ├─ TimelineActivityFeed (virtualized)
       └─ Export Markdown action
```

## Modules

| Module | Role |
|--------|------|
| `historyAreaEvolutionQueries.ts` | Area detail, journey periods, dashboard summary |
| `historyJourneyQueries.ts` | Global milestone progression path |
| `knowledgeHistoryExport.ts` | Deterministic markdown export |
| `bootstrapSummaryStorage.ts` | Post-import summary + dismiss flag |

## Related docs

- [K-46 Area Evolution](./K-46-area-evolution.md)
- [K-46 Knowledge Journey](./K-46-knowledge-journey.md)
- [K-46 Discovery Evolution](./K-46-discovery-evolution.md)
- [K-46 History Export](./K-46-history-export.md)
- [K-46 Validation Checklist](./K-46-validation-checklist.md)

## Future (K-47+)

- Area comparison view
- Export includes full activity feed
- Per-milestone narrative snippets
