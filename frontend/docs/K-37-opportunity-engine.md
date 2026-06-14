# K-37 Opportunity Engine

`actionEngine.ts` maps K-36 intelligence outputs to executable `CosmosActionItem` rows.

## Inputs (reuse only)

| Source | Used for |
|--------|----------|
| `snapshot.opportunities` | connect, view-candidates, assign-area |
| `snapshot.suggestedConnections` | add-relation (top 3) |
| `snapshot.gaps` | create-hub, area recommendations |
| `snapshot.importance` | resolve-isolated |
| `suggestAreaForNote()` | assign-area (suggested) |
| `enrichConnectionRecommendations()` | connection reason lines |

## Action kinds

```
connect | view-candidates | assign-area | create-hub | add-relation | resolve-isolated | link-related
```

## Priority (descending)

1. Opportunity connect (100 isolated / 70 weak)
2. Suggested area assign (85)
3. Create hub (75)
4. Resolve isolated (70)
5. Add relation (55 + capped score)
6. Other opportunities (assign-area 50, backlink 55)

## Connection enrichment

`enrichConnectionRecommendations` adds:

- `sharedTags` — tag intersection via index
- `mutualReferenceCount` — bidirectional mentions + wiki links
- `commonBacklinkCount` — shared backlink sources

`formatConnectionReasons` turns these into localized UI lines without duplicating suggestion scoring.

## Search integration

`countActionsForNote(snapshot)` — lightweight count for workspace search badge (opportunities + hub gap + top suggestions).
