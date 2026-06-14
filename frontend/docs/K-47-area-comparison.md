# K-47 Area Comparison

`AreaComparisonPanel.tsx` compares 2–4 areas side-by-side from recorded history.

## Access

Timeline Overview → **Compare Areas** button.

## Metrics per area

- Note count (vault)
- Link count (events)
- Note growth (period)
- Link growth (period)
- Momentum score (weighted)

## Selection

Toggle area chips from `timeline.areaEvolution` rows. Default: top 2 areas.

## Drill-through

Click a comparison column → opens `AreaEvolutionPanel` for that area.

## Limitations

- Max 4 areas
- Growth counts are event-based for the selected period (default 30 days)
