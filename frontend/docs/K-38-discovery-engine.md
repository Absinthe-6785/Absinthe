# K-38 Discovery Engine

Proactive knowledge surfacing built on K-36 intelligence and K-37 actions.

## Architecture

```
discovery/
  discoveryTypes.ts      — DiscoveryItem, DiscoveryFeed, DiscoverySummary
  discoveryScoring.ts    — centralized weights + score functions
  discoverySignals.ts    — signal collectors per discovery kind
  discoveryEngine.ts     — buildDiscoveryFeed orchestrator
```

Data flow:

1. **Signals** scan the vault using existing index + intelligence modules
2. **Scoring** ranks items deterministically (no AI)
3. **Feed** groups by section and sorts globally by score
4. **UI** renders Discover tab, dashboard card, HUD counts, search badge

## Discovery kinds

| Kind | Detection | Score formula |
|------|-----------|---------------|
| Forgotten knowledge | Core/major hubs inactive 30+ days | importance × inactivity |
| Missing connection | Strong overlap, no link/relation | similarity × relevance |
| Emerging topic | 3+ notes in 14-day tag/galaxy cluster | recency × cluster growth |
| Weak hub | Area with notes but no hub (K-36 gaps) | note count × hub absence |
| Knowledge drift | Important hubs/areas stale 60+ days | importance × inactivity |

## Integration points

- **Discover tab** — `DiscoveryPanel` in Knowledge Context panel
- **Dashboard** — `DiscoveryDashboardCard` in unified workspace overview
- **Graph HUD** — discovery summary counts + Review / Open Discover
- **Search** — `discoveryOpportunity` badge on matching notes

## Constraints

Deterministic only. Reuses `buildSuggestedConnections`, `buildKnowledgeGaps`, `evaluateKnowledgeImportance`, `noteLastOpenedAt`. No embeddings, LLM, or external APIs.
