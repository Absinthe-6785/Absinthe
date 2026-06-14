# K-45 Discovery Progress

Discovery resolution history is derived from `DISCOVERY_RESOLVED` events recorded by K-44 (`recordDiscoveryResolved`).

## UI location

Timeline **Overview** → **Discovery Progress** section (when `resolvedCount > 0`).

## Metrics (event-derived only)

| Metric | Derivation |
|--------|------------|
| Resolved Discoveries | Count of `DISCOVERY_RESOLVED` events |
| Most Improved Area | Area label with most `AREA_ASSIGNED`, `HUB_CREATED`, or `LINK_CREATED` events in period |
| Recent Momentum | Link + discovery events in last 30 days |
| Recent list | Up to 5 newest resolved events with drill-through |

## Action mapping

| `metadata.action` | Feed label |
|-------------------|------------|
| `connect`, `create-relation` | Missing Connection resolved |
| `create-hub` | Weak Hub resolved |
| `assign-area` | Forgotten Knowledge revisited |

## Limitations

- Pre-K-44 vaults only show discovery progress after users resolve discoveries post-upgrade
- Bootstrap does not synthesize discovery events
- Most Improved Area is a simple event-count heuristic, not semantic analysis

## Future

- Per-kind breakdown charts (still without chart library)
- Tie discovery events to original recommendation id for richer drill-through
