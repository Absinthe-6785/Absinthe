# K-33 — Validation Checklist

**Branch:** `k33-knowledge-universe`

---

## Automated

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

Expected: all pass (includes `knowledgeUniverse/*.test.ts`, `graphScalePolicy.test.ts`).

---

## Functional — Preserved

- [ ] Click node → selects note / opens in editor
- [ ] Search filters and highlights matches; non-matches dim
- [ ] Relationship filter (all / backlinks / mentions / relations)
- [ ] Isolated node toggle
- [ ] Scroll zoom + drag pan + zoom buttons
- [ ] Large graph label density (100+ / 250+ nodes)

---

## Functional — K-33 New

### Classification & sizing

- [ ] High-backlink / area / starred notes render as **Stars** (large, always labeled)
- [ ] Mid-backlink notes render as **Planets**
- [ ] Low-backlink notes render as **Moons** (labels only on focus/hover/search)

### Universe mode

- [ ] Toolbar **Network / Universe** toggle
- [ ] Preference survives reload (`absinthe-graph-view-mode`)
- [ ] Universe: visible domain separation (area-linked clusters)
- [ ] Universe: subtle planet/moon motion (not aggressive)
- [ ] Network: no galaxy boost; matches familiar force layout

### Focus universe

- [ ] Selecting a note fades distant nodes (depth 2 neighborhood)
- [ ] Connected edges emphasized on selection

### Edges

- [ ] Backlinks: solid, thicker
- [ ] Mentions: dashed
- [ ] Relations / weak: dotted or thin
- [ ] Hover / selection increases edge opacity

### Accessibility

- [ ] Tab to nodes; Enter selects
- [ ] `prefers-reduced-motion` disables orbit + pulse

---

## Visual Spot Check

| Scenario | Expected |
| -------- | -------- |
| Area note + members | Same galaxy label in tooltip |
| Starred low-link note | Star tier despite low backlinks |
| Active selection | Outer ring + pulse (if motion allowed) |
| Universe + History area | History cluster visually separated |

---

## Out of Scope (Do Not Regress)

- Planner, Archive, Health, NoteView editor chrome
- Local graph (`LocalGraphView`) — unchanged

---

## Sign-off

| Check | Result |
| ----- | ------ |
| typecheck | |
| build | |
| test | |
| Manual graph smoke | |
