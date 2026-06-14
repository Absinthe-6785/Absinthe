# K-41 Tier Classification Guide

**Branch:** `k41-cosmos-onboarding`

---

## Component: `WhyThisTier`

Expandable “Why this tier?” control showing:

1. Classification label (Core Hub, Major Hub, …)
2. One-line tier explanation (i18n)
3. Up to 4 deterministic factors

---

## Factor Sources (`tierExplanation.ts`)

| Factor key | Trigger |
|------------|---------|
| Area hub note | `isAreaNote` |
| Starred note | `isStarred` |
| Referenced by N notes | `backlinkCount > 0` |
| N outgoing links | `outgoingLinkCount > 0` |
| Shared tag neighbors | `sharedTagNeighborCount >= 3` |
| No links | `totalLinks === 0` |
| Updated recently | `updatedAt` within 7 days |
| Importance score | Fallback when no other factors |

---

## Example: Core Hub

```
Core Hub

Central anchor note with high influence in your vault.

• Referenced by 14 notes
• Updated recently
```

---

## Surfaces

| Surface | Implementation |
|---------|----------------|
| Insights | `WhyThisTier` under classification header |
| Discovery | Tier in forgotten-knowledge reason lines |
| Search | `tierHint` subtitle + badge tooltip |

---

## Classification Reference

| Tier | Expected role |
|------|---------------|
| Core Hub | Vault anchor, area note, high backlinks |
| Major Hub | Strong connector (4+ backlinks or high score) |
| Supporting | Linked, moderate role |
| Satellite | Peripheral with some links |
| Isolated | No meaningful connections |

Engine unchanged — `knowledgeImportance.ts` (K-36).
