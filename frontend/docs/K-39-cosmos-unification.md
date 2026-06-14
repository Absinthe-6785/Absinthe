# K-39 Cosmos Unification

K-39 consolidates K-33 through K-38 into one coherent **Knowledge Cosmos** product surface.

## Unified stack

```
Knowledge (notes, links, areas)
    ↓
Cosmos (spatial visualization + local neighborhood)
    ↓
Insights (diagnostics — K-36)
    ↓
Actions (one-click mutations — K-37)
    ↓
Discovery (proactive surfacing — K-38)
```

## What changed

| Area | Change |
|------|--------|
| Terminology | User-facing "Graph" → "Cosmos" where remaining; hover hint uses "note" not "node" |
| Navigation | Orbit icon for Cosmos entry points; context panel subtitle lists full suite |
| Visual identity | `CosmosSuiteHeader` on Insights, Actions, Discover; shared badges in `cosmosPanelUi.tsx` |
| Discovery quality | Higher thresholds, deduplication, confidence tiers, reason lines |
| HUD | `aria-label` for Cosmos intelligence summary |

## What did NOT change

- Graph renderer (`NoteGraphView` force simulation)
- Internal module names (`knowledgeUniverse/`, `buildGlobalGraphData`)
- Intelligence scoring (K-36) and action engine (K-37) logic

## Module layout

```
cosmos/
  cosmosPanelUi.tsx     — shared suite header, confidence badges, reason blocks
  intelligence/       — K-36 (unchanged)
  actions/              — K-37 (suite header added)
discovery/
  discoveryScoring.ts   — calibrated weights + confidence tiers
  discoveryReasons.ts   — formatted reason lines for feed cards
  discoveryEngine.ts    — refineDiscoveryItems deduplication
```

## Success criteria

- No user-facing "Graph vs Cosmos" confusion in i18n strings
- Insights / Actions / Discover feel like one system
- Discovery feed shows confidence + reasons, fewer duplicates
