# K-36 — Suggested Connections

**Module:** `cosmos/intelligence/suggestedConnections.ts`

---

## Purpose

Lightweight, deterministic link recommendations without AI — complements existing `getRelatedNotes` with additional local signals.

---

## Signals

| Signal | Weight | Detection |
| ------ | ------ | --------- |
| Existing related | 10 + score×0.5 | `KnowledgeIndexService.getRelatedNotes` |
| Title similarity | up to 8 | Token overlap ≥35% |
| Shared area | 5 | Same non-uncategorized galaxy |
| Shared tag | 6 | Any tag intersection |
| Mutual mention | 4 | Both notes mention each other (unlinked) |
| Common backlink | 7×count | Shared incoming link sources |

---

## API

```typescript
buildSuggestedConnections(noteId, notes, service, galaxyMap, { limit? })
```

Default limit: 6 suggestions, sorted by score descending.

---

## UI

**Insights tab** — "Suggested connections" section with signal labels via `suggestionSignalLabel()`.

---

## Constraints honored

- Local only
- No embeddings
- Deterministic for same note graph
