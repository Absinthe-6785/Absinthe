# K-44 Dashboard Activity

---

## Component

`KnowledgeActivityCard.tsx` — overview tab on unified workspace dashboard.

---

## Data

`getActivitySummary(30)` from recorded events:

- Notes created
- Links created
- Hubs created
- Discoveries resolved

Card hidden when all counts are zero.

---

## Placement

Overview tab order (after onboarding):

1. Product tour / start dashboard (when applicable)
2. **Knowledge Activity** (when events in window)
3. Timeline card
4. Discovery card
5. Insights / review / paths

---

## vs Timeline card

| Card | Data source |
|------|-------------|
| Knowledge Activity | Raw event counts (30d) |
| Knowledge Growth (Timeline) | Period growth + structural snapshots |

Both can appear together when history and timeline snapshots exist.
