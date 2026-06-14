# K-36 — Knowledge Opportunities

**Module:** `cosmos/intelligence/knowledgeOpportunities.ts`

---

## Purpose

Automatic detection of notes that would benefit from user action — surfaced in the **Insights** tab and counted in the **Cosmos HUD**.

---

## Detection rules

| Kind | Trigger | Recommended action key |
| ---- | ------- | ---------------------- |
| `connect` | Classification isolated OR connection score ≤1 | `k36OppActionConnect` |
| `add-backlink` | Zero incoming backlinks AND has outgoing links | `k36OppActionAddBacklink` |
| `assign-area` | Not area note, galaxy uncategorized/folder-only, no `area` property | `k36OppActionAssignArea` |

Connect opportunities include a **target note** when available (top related note or highly-connected hub).

---

## API

```typescript
buildKnowledgeOpportunities(notes, service, galaxyMap, { noteId?, limit? })
```

- Vault mode: all active notes, default limit 12
- Note mode: single note, default limit 5

---

## UI

- **CosmosInsightsPanel** — "Knowledge opportunities" section with actionable rows
- **Cosmos HUD** — `Opportunities: {count}` aggregate

---

## Tests

`cosmosAnalysis.integration.test.ts` — isolated note produces `connect` opportunity.
