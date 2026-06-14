# K-46 Discovery Evolution

Discovery Progress (Timeline Overview) now includes period trends.

## Metrics

| Metric | Source |
|--------|--------|
| Resolved (total) | All `DISCOVERY_RESOLVED` events |
| Last 30 days resolved | Recent window count + trend (↑ → ↓) |
| Connections added | `action: connect` / `create-relation` |
| Hubs created | `action: create-hub` |
| Areas improved | `action: assign-area` |

## Trend logic

Compares resolved count in last 30 days vs previous 30 days:

- More recent → ↑
- Equal (non-zero) → →
- Fewer → ↓

## Limitations

- Trend is count-based, not severity-weighted
- No pre-K-44 synthetic discovery events
