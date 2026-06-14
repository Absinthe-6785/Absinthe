# K-38 Missing Connections

Surfaces note pairs with strong contextual overlap but no existing link or relation.

## Overlap signals (reused from K-36)

- Shared tags
- Shared area / galaxy
- Title similarity
- Mutual mentions
- Common backlinks

Uses `buildSuggestedConnections` then filters out:

- Pairs with existing wiki links (either direction)
- Pairs with `related-to` relation
- Suggestions already marked `related`

## Score

```
score = suggestionScore × relevance
```

Where relevance incorporates source note importance classification.

Minimum suggestion score: 8 (`DISCOVERY_WEIGHTS.MIN_CONNECTION_SCORE`).

## UI

```
French Grammar
Potential connection: French Verbs
[Open] [Create relation]
```

Vault scan limited to top 35 source notes × 2 suggestions each.
