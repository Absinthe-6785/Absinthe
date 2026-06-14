# K-36 — Area Health Analysis

**Module:** `cosmos/intelligence/areaHealth.ts`

---

## Purpose

Per-galaxy (area cluster) health scoring to answer: *Is this knowledge domain thriving or fragmented?*

---

## Metrics

| Metric | Source |
| ------ | ------ |
| Note count | Members of galaxy from `buildNoteGalaxyMap` |
| Average connections | Mean `getConnectionScore` per member |
| Orphan ratio | Share of members with connection score ≤1 |
| Hub coverage | Area note exists OR core/major hub classification |
| Milestone coverage | Any trace or project milestone in galaxy |

---

## Score formula (0–100)

- Connection density: up to 40 points
- Orphan inverse: up to 30 points
- Hub bonus: 20 points
- Milestone bonus: 10 points
- Size bonus: up to 20 points (2 per note)

---

## Categories

| Score | Category |
| ----- | -------- |
| ≥80 | Thriving |
| ≥65 | Healthy |
| ≥50 | Growing |
| ≥35 | Fragmented |
| <35 | Critical |

---

## UI exposure

- **Insights tab** — current note's galaxy health row
- **Cosmos HUD** — top 3 area health preview lines (`History 82% · Healthy`)
- **Knowledge gaps** — uses health metrics for gap detection

---

## API

```typescript
buildAreaHealthSummaries(notes, service, galaxyMap): AreaHealthSummary[]
```
