# K-33 — Node Classification (Star / Planet / Moon)

---

## Types

```ts
type GraphNodeTier = 'star' | 'planet' | 'moon';
```

Implemented in `graphNodeTier.ts` via `classifyGraphNodeTier()`.

---

## Criteria

| Tier | Rule | Examples |
| ---- | ---- | -------- |
| **Star** | `backlinkCount >= 10` **OR** area/root note **OR** starred (pinned hub) | History, TOEFL, Japanese, Absinthe |
| **Planet** | `backlinkCount` 3–9 | Grammar, Voca, EJU, French |
| **Moon** | `backlinkCount <= 2` | French Day12, Napoleon, Voca Week3 |

Backlink count uses `KnowledgeIndexService.getBacklinkCount(title, noteId)` (incoming wiki links, excluding self).

Area notes: `isAreaNote()` from `areaNotes.ts` (`type=area` property).

Pinned hub: `note.starred === true` (Absinthe has no separate pin field).

---

## Visual Mapping

| Tier | Radius | Label | Motion |
| ---- | ------ | ----- | ------ |
| Star | Largest (`nodeRadiusFromImportance`) | Always visible | Glow + slow pulse |
| Planet | Medium | Hover / focus / search | Orbit-capable (Universe) |
| Moon | Smallest | Focus / hover / search only | Orbit-capable (Universe) |

---

## Importance Score

Node **size** derives from `calculateKnowledgeImportance()`, not link count alone:

```ts
importance =
  (backlinkCount * 3)
  + (viewCount * 1)      // 0 until view telemetry exists
  + recencyWeight(updatedAt)
  + (isAreaNote ? 15 : 0)
```

`nodeRadiusFromImportance(importance, tier)` maps score → pixel radius.

---

## Diagram

```text
        ★ Star (area / 10+ backlinks / starred)
       / \
   ● Planet (3–9 backlinks)
     |
   · Moon (0–2 backlinks)
```

---

## Tests

`graphNodeTier.test.ts`, `knowledgeImportance.test.ts`
