# K-36 — Cosmos Intelligence

**Branch:** `k36-cosmos-intelligence`  
**Builds on:** K-35 NoteView Modernization

---

## Summary

K-36 evolves Cosmos from a visualization layer into a deterministic, local knowledge intelligence system. No AI, embeddings, or external services — all signals derive from existing notes, links, tags, areas, and graph indexes.

**Verification:**

```text
Typecheck: PASS (0 errors)
Build:     PASS
Tests:     PASS (1794 / 1794, +9 intelligence tests)
```

---

## Architecture

```text
features/knowledge/cosmos/intelligence/
├── importanceWeights.ts      # Centralized scoring constants
├── knowledgeImportance.ts    # Task A — importance score + classification
├── knowledgeOpportunities.ts # Task B — orphan / weak / area opportunities
├── suggestedConnections.ts   # Task C — tag/area/title/backlink suggestions
├── areaHealth.ts             # Task E — per-galaxy 0–100 health score
├── knowledgeGaps.ts          # Task F — structural gap detection
├── cosmosAnalysis.ts         # Orchestrators (note snapshot + vault analysis)
└── index.ts                  # Public barrel
```

**UI integration:**

| Surface | Component / file |
| ------- | ---------------- |
| Insights tab | `CosmosInsightsPanel.tsx` → `NoteView` |
| Cosmos HUD | `NoteGraphView.tsx` + `buildCosmosVaultAnalysis` |
| Search badges | `buildWorkspaceSearch.ts` + `WorkspaceSearchPalette.tsx` |
| Labels | `knowledgeLabels.ts` (classification, area health, signals) |

---

## Intelligence rules (deterministic)

### Importance (Task A)

Weighted sum: backlinks ×4, outgoing ×2, incoming refs ×3, mentions ×2, tag neighbors ×1, area +12, star +8, milestone +10, recency up to +8.

Classification thresholds: Core Hub (≥45 or area/star hub), Major Hub (≥28), Supporting (≥14), Satellite (≥4), Isolated (no connections).

### Opportunities (Task B)

- **Connect** — isolated or connection score ≤1
- **Add backlink** — outgoing links but zero incoming
- **Assign area** — uncategorized galaxy, no area property

### Suggested connections (Task C)

Signals: existing related score, title token overlap (≥35%), shared galaxy, shared tags, mutual mentions, common backlink sources.

### Area health (Task E)

Per-galaxy: connection density, orphan ratio, hub presence, milestone presence, note count → 0–100 score → Thriving / Healthy / Growing / Fragmented / Critical.

---

## Tasks completed

| Task | Status |
| ---- | ------ |
| A — Knowledge Importance Engine | Done |
| B — Knowledge Opportunities | Done |
| C — Suggested Connections | Done |
| D — Insights tab | Done |
| E — Area Health Analysis | Done |
| F — Knowledge Gap Detection | Done |
| G — Cosmos HUD upgrade | Done |
| H — Search integration | Done |
| I — Documentation | Done |

---

## Related docs

- [Knowledge opportunities](./K-36-knowledge-opportunities.md)
- [Suggested connections](./K-36-suggested-connections.md)
- [Area health](./K-36-area-health.md)
- [Insights panel](./K-36-insights-panel.md)
- [Validation checklist](./K-36-validation-checklist.md)

---

## K-37 backlog

- Opportunity actions that mutate notes (auto-link, set area property)
- Insights tab default on first Cosmos open (FTUE)
- Per-area drill-down from HUD click
- Relation-type weighted suggestions
