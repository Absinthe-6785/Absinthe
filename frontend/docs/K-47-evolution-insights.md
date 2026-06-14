# K-47 Evolution Insights

K-47 adds actionable evolution insights on top of K-44–K-46 history infrastructure.

## Architecture

```
NoteView
  ├─ buildEvolutionInsightsSummary (momentum + dormant + milestones)
  ├─ KnowledgeEvolutionCard (dashboard)
  └─ TimelinePanel
       ├─ AreaComparisonPanel
       ├─ DormantAreasSection
       ├─ KnowledgeJourneyPanel (with dates)
       └─ TimelineExportMenu (copy + download)
```

## Modules

| Module | Role |
|--------|------|
| `knowledgeMomentum.ts` | Weighted momentum scoring |
| `DormantAreaAnalyzer.ts` | Stale area detection |
| `historyAreaComparisonQueries.ts` | Multi-area comparison data |
| `evolutionInsightsQueries.ts` | Combined dashboard insights |
| `KnowledgeEvolutionReport.ts` | Period markdown report |

## Related docs

- [Area Comparison](./K-47-area-comparison.md)
- [Knowledge Momentum](./K-47-knowledge-momentum.md)
- [Dormant Detection](./K-47-dormant-area-detection.md)
- [Evolution Report](./K-47-evolution-report.md)
- [Validation Checklist](./K-47-validation-checklist.md)
