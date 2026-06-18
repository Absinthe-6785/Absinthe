# K-95C — Knowledge Index Memory Reduction

Reduces retained memory inside `KnowledgeIndexService` while preserving graph, related notes, mentions, backlinks, and discovery behavior.

## Changes

| Area | Behavior |
|------|----------|
| **Compact related refs** (`relatedCompactRef.ts`) | Store `{ noteId, score, reasonFlags }` instead of duplicated titles/reason arrays |
| **Lazy title hydration** | `getRelatedNotes()` resolves titles from `activeNotes` at read time |
| **Derived counts** | `deriveUniqueRelatedCount()` replaces retained `uniqueRelatedCount` map |
| **Backlink/mention ids** | Incoming/mention indexes store source note ids only; titles hydrated on read |
| **Title search index** | Mention scan uses note id list + `activeNotes` lookup (no duplicated title strings) |

## Memory targets

| Metric | Target |
|--------|--------|
| `relatedByNoteId` | ~30–40% reduction vs legacy object shape |
| Index total | ~15–25% reduction vs pre-K-95C estimate |
| Retained objects | Fewer duplicated strings and counter maps |
| Title duplication | Removed from related/backlink/mention retained storage |

## Audit matrix

Run `npm test -- k95cKnowledgeIndex` to print metrics at 100 / 300 / 1000 / 3000 notes:

- Index total bytes
- `relatedByNoteId` bytes
- Title duplication bytes reclaimed (backlinks + mentions)
- Retained object count
- Legacy vs compact related reduction %
- Overall index reduction %

## Compatibility

Public APIs unchanged:

- `RelatedNote` shape returned from `getRelatedNotes()`
- `PageReference` shape from `getIncoming()` / `getMentions()`
- Ranking order preserved (score desc, title asc tie-break)
- Incremental `updateNote()` / `removeNote()` / `buildFromNotes()` parity

## Verification

```bash
npm run typecheck
npm test
npm run build
npm test -- k95cKnowledgeIndex
```

## Out of scope

Graph simulation, note schema, storage layer (K-96), discovery candidate pools (K-95D), search ranking.

## After K-95C

```text
K-95A ✓ Discovery context sharing
K-95B ✓ Link context offset index
K-95C ✓ Knowledge index memory reduction
↓
K-95D Discovery candidate memory optimization
↓
K-95E Large vault memory audit and allocator cleanup
```
