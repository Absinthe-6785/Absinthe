# K-33 — Focus Universe Mode

---

## Trigger

When **`activeNoteId`** is set (note selected in graph), the view enters focus universe mode.

Hover-only still uses a lightweight **1-hop** neighborhood (prior K-31 behavior).

---

## Neighborhood (`buildFocusUniverse`)

BFS over undirected edges to depth **2** (`DEFAULT_FOCUS_DEPTH`):

Includes:

- Selected note
- Direct neighbors (parents, children, backlinks)
- Second-hop nearest neighbors

Configurable constant in `focusUniverse.ts` for future UI control.

---

## Visual Behavior

| Element | In focus set | Outside focus set |
| ------- | ------------ | ----------------- |
| Node opacity | 1 | 0.12 when selection active; 0.3 on hover-only dim |
| Edge | Full style | Dimmed via existing edge opacity rules |
| Labels | Tier rules apply | Moons hidden unless matched |

Search filter still takes precedence over focus dimming.

---

## Diagram

```text
selected note
    ↓
 local universe (depth 2)
    ↓
 unrelated nodes faded
```

---

## Tests

`focusUniverse.test.ts`
