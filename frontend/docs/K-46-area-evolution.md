# K-46 Area Evolution

`AreaEvolutionPanel.tsx` opens when clicking an area row in Timeline Overview.

## Data

`buildAreaEvolutionDetail()` filters K-44 events by area label (property, hub title, event metadata).

## UI sections

- **Summary** — age, note/link counts, growth trend
- **History Timeline** — monthly note deltas + hub/discovery highlights
- **Area Milestones** — hub created, discovery resolved
- **Recent Activity** — latest area events with drill-through

## Navigation

Back button returns to Timeline Overview. Activity rows navigate to notes via `onNavigateToNote`.

## Limitations

- Link counts are event-based, not graph edge counts
- Monthly grouping uses calendar month buckets
- Areas without recorded events show vault snapshot counts only
