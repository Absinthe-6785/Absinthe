# K-38 Emerging Topics

Identifies clusters of recently active notes suggesting a new knowledge domain.

## Detection

Within `EMERGING_WINDOW_DAYS` (14):

- Group recent notes by **primary tag** or **galaxy label**
- Require ≥ 3 notes per cluster (`EMERGING_MIN_NOTES`)

Recency uses `createdAt` (or ID timestamp fallback) and `updatedAt`.

## Score

```
score = (14 - newestNoteAge) × recencyWeight + (noteCount - 2) × growthWeight × 10
```

## UI

```
Modern European History
7 notes · last 14 days
[Open]
```

Dashboard and HUD show emerging topic counts.
