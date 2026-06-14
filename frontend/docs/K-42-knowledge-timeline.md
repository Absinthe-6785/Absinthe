# K-42 Knowledge Timeline

**Branch:** `k42-knowledge-timeline`

## Architecture

```
timeline/
├── timelineTypes.ts       # Types
├── timelineMetrics.ts     # Counts, density, discovery history heuristics
├── timelineSnapshots.ts   # Period buckets (month/quarter/all)
├── knowledgeTimeline.ts   # buildKnowledgeTimeline() orchestrator
└── TimelineMetricExplain.tsx
```

**UI:** `TimelinePanel`, `TimelineDashboardCard`, Cosmos HUD evolution block.

**Data sources:** `createdAt`, `updatedAt`, `lastOpenedAt`, links, areas, hubs, galaxies, discovery feed — no new persistence.

## Views

| Mode | Buckets |
|------|---------|
| Month | End-of-month cumulative snapshots |
| Quarter | Quarterly cumulative snapshots |
| All time | Single snapshot |

## Limitation

Historical link/deletion events are not stored. Snapshots approximate growth using notes that exist today with `createdAt <= period end`.
