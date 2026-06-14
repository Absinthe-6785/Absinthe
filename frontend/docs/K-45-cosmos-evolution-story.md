# K-45 Cosmos Evolution Story

`CosmosEvolutionStory.tsx` presents a readable narrative from recorded history.

## Example output

```
Your Cosmos began on Feb 11, 2026.
The first connection was created 2 days later.
The first hub emerged on Mar 2, 2026.

Since then:
+172 notes
+304 links
+9 hubs
```

## Data pipeline

1. `buildCosmosEvolutionSummary()` — first note/link/hub timestamps and current counts
2. `buildCosmosEvolutionStory()` — day gaps and cumulative adds from events

## Imported history

When all events are imported (`importedOnly`), counts and dates still render but an imported hint is shown. Story prefers non-imported events for "since then" counts when real history exists.

## Dashboard integration

Evolution summary appears in Timeline Overview; story block follows summary. Dashboard card uses separate recent-activity and milestone snippets.

## Limitations

- Narrative is template-based, not free-form prose
- Does not mention individual note titles beyond milestone drill-through elsewhere
- Growth counts are event counts, not net vault delta (deletes not subtracted in story)

## Future

- Week/month chapter breaks for long histories
- Optional export as markdown snippet
