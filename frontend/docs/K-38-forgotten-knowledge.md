# K-38 Forgotten Knowledge

Detects important notes the user has not revisited recently.

## Criteria

- Classification: **core-hub** or **major-hub** (K-36 importance)
- Inactivity: `daysSince(noteLastOpenedAt)` ≥ 30 (`DISCOVERY_WEIGHTS.MIN_FORGOTTEN_DAYS`)
- Scans top 40 important notes by importance score

## Score

```
score = importanceScore × (min(inactivityDays, 180) / 30)
```

Weights in `discoveryScoring.ts` → `DISCOVERY_WEIGHTS`.

## UI

**Discover feed** section: Forgotten Knowledge

Example card:

```
History Hub
Last opened 92 days ago · Core Hub
[Revisit]
```

**Dashboard:** `{count} forgotten notes`

**HUD:** `Forgotten notes: {count}`
