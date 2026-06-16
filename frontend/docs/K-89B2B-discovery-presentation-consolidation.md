# K-89B2B — Discovery Presentation Consolidation

**Branch:** `k89b2b-discovery-presentation-consolidation`  
**Status:** Implemented  
**Scope:** Presentation deduplication, feed ownership, navigation — no collector/ranking changes  
**Prerequisite:** K-89B2 Discovery Surface Consolidation Audit

---

## Executive Summary

K-89B2B removes **competing copies** of vault discovery content while preserving discovery quality. **Discover** is the single canonical feed; supporting surfaces **link, preview, or reference** it.

| Change | Before | After |
|--------|--------|-------|
| Connection suggestions | Insights + Actions + Discover (3 full lists) | Discover only; Insights/Actions → Open Discover CTA |
| Cosmos HUD feed | Rebuilt `buildDiscoveryFeed` locally | Reuses `useNoteViewDashboard` memo via `sharedDiscoveryFeed` |
| Dashboard card | Count summary (ambiguous ownership) | Same counts + explicit “summary only → Discover tab” |
| Worth Revisiting | Collapsed whenever Most Related had items | Collapsed only when Most Related has ≥ 3 items |

**Not changed:** collectors, ranking, K-89D1 performance, tab count, Links/Related Notes engines.

---

## A. Consolidation Report — Surface Inventory

### Before

| Surface | Discovery content shown |
|---------|-------------------------|
| **Discover** (primary) | Full 6-section feed, top 18 items |
| **Insights** | Full suggested-connection cards with WhyThisRecommendation |
| **Actions** | `ConnectionRecommendationList` with create-relation actions |
| **Dashboard card** | Summary counts + Open Discover |
| **Cosmos HUD** | Independent `buildDiscoveryFeed` + summary lines |
| **Search palette** | Discovery section from prop or fallback build |
| **Worth Revisiting** | Per-note stale neighbors (collapsed when any Most Related) |

### After

| Surface | Role | Discovery content |
|---------|------|-------------------|
| **Discover** | **Owner** | Full feed (unchanged) |
| **Insights** | Analysis | Count + CTA when suggestions exist; gaps/opportunities/tier unchanged |
| **Actions** | Execution | Action checklist + area guidance; connections → CTA only |
| **Dashboard card** | Entry pointer | Counts + hint + Open Discover |
| **Cosmos HUD** | Spatial + snapshot | Vault analysis + **shared** feed summary; CTAs to Discover |
| **Search palette** | Quick search | Uses parent `discoveryFeed` when provided |
| **Worth Revisiting** | Per-note revisit | Expanded when Most Related &lt; 3 (less hidden overlap with Discover forgotten) |

---

## B. Worth Revisiting vs Forgotten Knowledge

| Aspect | Worth Revisiting | Forgotten Knowledge (Discover) |
|--------|------------------|--------------------------------|
| Scope | Neighbors of **active note** | **Vault-wide** inactivity |
| Engine | `groupRelatedNotes` + `worthRevisitingScore` | Discovery collectors (unchanged) |
| Intent | “What around **this** note is stale?” | “What in the vault am I **forgetting**?” |
| Overlap | Both surface stale knowledge | Different pools — presentation only adjusted |
| K-89B2B | Collapse threshold relaxed (≥3 Most Related) | Remains canonical vault stale feed |

No ranking logic was modified.

---

## C. Implementation Notes

### Files changed

- `CosmosInsightsPanel.tsx` — Discover CTA replaces duplicate suggestion cards
- `CosmosActionsPanel.tsx` — removed `ConnectionRecommendationList`
- `NoteContextPanelBody.tsx` — `onOpenDiscover` on Insights
- `NoteGraphView.tsx` — optional `sharedDiscoveryFeed`; skip local feed build when set
- `NoteViewEditorArea.tsx` — passes `discoveryFeed` to graph
- `NoteView.tsx` / `useNoteViewEditorAreaProps.ts` — `discoveryFeed` in editor data
- `DiscoveryDashboardCard.tsx` — ownership hint copy
- `RelatedNotesPanel.tsx` — Worth Revisiting collapse threshold
- `WorkspaceSearchPalette.tsx` — JSDoc on canonical feed prop
- `i18n.ts` — `k89b2*` strings

### Shared feed reuse

```text
useNoteViewDashboard (discoveryFeed memo)
  ├─ Discover tab
  ├─ Dashboard card / timeline scope
  ├─ WorkspaceSearchPalette (NoteView)
  └─ NoteGraphView HUD (sharedDiscoveryFeed)  ← new
```

---

## D. Navigation Validation

| Path | Expected behavior |
|------|-------------------|
| Insights → suggested connections | “Open Discover” opens Discover primary tab |
| Actions → connection count | Same CTA when `plan.connections.length > 0` |
| Dashboard card | Counts + hint; button → Discover tab |
| Cosmos HUD | Summary lines match shared feed; buttons → Discover |
| Links → Worth Revisiting | Visible when Most Related has 0–2 items |

---

## E. Regression Tests

`discoveryPresentationConsolidation.test.ts` guards:

- No duplicate suggestion rendering in Insights/Actions
- `sharedDiscoveryFeed` wiring in graph + editor
- Dashboard hint copy
- Worth Revisiting collapse rule
- Discover remains primary tab

Existing `knowledgeContextIa.test.ts` (K-89B1) unchanged.

---

## F. Deferred (K-89B3+)

- Tags tab vs Properties tag CRUD overlap (audit — not low-risk)
- Knowledge Review `leastRevisited` vs Discover presentation merge
- Removing `buildDiscoveryFeed` fallback in search palette when all call sites pass prop

---

## Success Criteria

Users encounter vault connection suggestions and rediscovery feeds in **one canonical place** (Discover) and are **guided there** from Insights, Actions, Dashboard, and Cosmos HUD instead of seeing multiple competing lists.
