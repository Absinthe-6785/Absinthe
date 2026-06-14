# K-44 Timeline Upgrade

---

## Before (K-42)

Growth metrics estimated from:
- `createdAt` / `updatedAt`
- Cumulative snapshot diffs (link count delta)
- Heuristic discovery history scan

---

## After (K-44)

When `historyEvents.length > 0`:

| Metric | Source |
|--------|--------|
| `growth.vault.*` | Event counts in current period bucket |
| `growth.discovery.discoveriesResolved` | `DISCOVERY_RESOLVED` events |
| `recentEvolution.notesAdded/linksAdded` | Event counts in recent window |
| `discoveryHistory` | Event-derived link/hub/discovery counts |

When **no history**:

- Identical K-42 behavior (`usesEventHistory: false`)

---

## Unchanged

- Snapshot charts (note/link/hub counts at period end) — still structural estimates
- Milestones — still threshold-based on snapshots
- Area evolution rows — still note distribution by area
- Timeline UI — no redesign

---

## Module

`timeline/timelineHistoryMetrics.ts` — merges event growth into estimated `TimelineGrowthMetrics`.
