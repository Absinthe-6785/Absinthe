# K-47 Dormant Area Detection

`DormantAreaAnalyzer.ts` identifies areas with no meaningful recent activity.

## Threshold

**60 days** (`DORMANT_THRESHOLD_DAYS`) without meaningful events.

## Meaningful event types

- `NOTE_CREATED`
- `LINK_CREATED`
- `AREA_ASSIGNED`
- `HUB_CREATED`
- `DISCOVERY_RESOLVED`

## Rules

An area is dormant when:

1. It has at least one note in the vault, AND
2. Last meaningful event is older than 60 days (or never recorded), OR
3. K-42 area evolution trend is `dormant`

## UI integration

- Timeline Overview → **Dormant Areas** section
- Dashboard → dormant warning on `KnowledgeEvolutionCard`

## Limitations

- Imported bootstrap events count as activity at import timestamp
- Areas without property labels may be missed
