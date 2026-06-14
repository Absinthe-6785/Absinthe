# K-45 Knowledge History Experience

K-45 turns the K-44 history engine into a user-facing knowledge evolution experience inside Cosmos Timeline and the workspace dashboard.

## Architecture

```
NoteView
  ├─ maybeBootstrapKnowledgeHistory (once, local)
  ├─ historyEvents ← loadKnowledgeHistoryEvents + subscribe
  └─ TimelinePanel (Overview | Activity | Milestones)
       ├─ Overview: evolution summary, story, growth metrics, area trends, discovery progress
       ├─ Activity: TimelineActivityFeed (K-44 events only)
       └─ Milestones: achievement list with drill-through

UnifiedWorkspaceDashboard
  └─ KnowledgeActivityCard (recent activity, latest milestone, growth trend)
```

## Modules

| Module | Role |
|--------|------|
| `historyBootstrap.ts` | One-time seed from vault state |
| `historyEventPresentation.ts` | Feed labels, date grouping, imported markers |
| `historyEvolutionQueries.ts` | Summary, story, discovery progress, milestone navigation |
| `TimelineActivityFeed.tsx` | Chronological activity UI |
| `KnowledgeEvolutionSummary.tsx` | First note/link/hub + current scale |
| `CosmosEvolutionStory.tsx` | Narrative evolution block |
| `DiscoveryProgressSection.tsx` | Resolved discovery metrics |

## Constraints

- No server APIs, AI, embeddings, or telemetry
- No Cosmos renderer or timeline visual redesign
- Uses K-44 event types and local storage only

## Related docs

- [K-45 Activity Feed](./K-45-activity-feed.md)
- [K-45 History Bootstrap](./K-45-history-bootstrap.md)
- [K-45 Discovery Progress](./K-45-discovery-progress.md)
- [K-45 Cosmos Evolution Story](./K-45-cosmos-evolution-story.md)
- [K-45 Validation Checklist](./K-45-validation-checklist.md)

## Future (K-46+)

- Virtualized activity feed for very large histories
- Per-area drill-through from area evolution rows
- Export/share evolution story
- Merge imported bootstrap with first real event timeline
