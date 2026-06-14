# K-47 Knowledge Momentum

`knowledgeMomentum.ts` computes deterministic area and cosmos momentum scores.

## Weights

| Event type | Weight | Rationale |
|------------|--------|-----------|
| `NOTE_CREATED` | 3 | Primary growth |
| `LINK_CREATED` | 2 | Connection activity |
| `HUB_CREATED` | 4 | Structural milestone |
| `AREA_ASSIGNED` | 2 | Organization |
| `DISCOVERY_RESOLVED` | 3 | Intentional improvement |

## Outputs

- **Fastest Growing Area** — timeline `recentEvolution` or period note deltas
- **Most Active Area** — highest weighted score in period
- **Most Connected Area** — most `LINK_CREATED` events in period
- **Most Improved Area** — most discovery/area events in period
- **Cosmos Momentum Score** — sum of weighted period events

Default period: 30 days.

## Usage

`buildKnowledgeMomentumSnapshot()` feeds `EvolutionInsightsSummary` and area comparison.
