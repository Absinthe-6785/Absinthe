# K-33 — Galaxy Clustering

---

## Purpose

Group notes into **domain galaxies** so the graph reads as separate knowledge regions instead of one mixed cloud.

Examples: TOEFL Galaxy, Japanese Galaxy, History Galaxy, Coding Galaxy, Absinthe Galaxy.

---

## Assignment (`buildNoteGalaxyMap`)

Priority order per note:

1. **Area note** → galaxy id = area note id; label = area title
2. **Outgoing link to area note** → member of that area galaxy
3. **Backlink to area title** (`getNotesLinkedTo`) → member of that area galaxy
4. **Folder** → `folder:{folderId}`
5. **Fallback** → `uncategorized`

---

## Force Simulation (Universe mode)

When `graphViewMode === 'universe'`:

| Force | Constant | Effect |
| ----- | -------- | ------ |
| Inter-galaxy repulsion boost | `INTER_GALAXY_REPULSION_BOOST` (1.8×) | Galaxies repel each other |
| Intra-galaxy cohesion | `INTRA_GALAXY_COHESION` (0.012) | Nodes pull toward galaxy centroid |

Centroids recomputed each simulation step via `computeGalaxyCenters()`.

Network mode skips both helpers — behavior matches pre-K-33 physics.

---

## Layout Sketch

```text
[ History Galaxy ]          [ Japanese Galaxy ]
      ★ History                  ★ Japanese
     ● ● Planets                 ● Grammar
    · · Moons                    · Day12
```

---

## Stability

- Cohesion strength kept low to avoid fighting link springs
- Repulsion boost is multiplicative on existing pairwise repulsion
- Simulation alpha floor unchanged from `graphScalePolicy`

---

## Tests

`galaxyClustering.test.ts`
