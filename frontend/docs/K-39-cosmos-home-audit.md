# K-39 Cosmos Home Audit

## Question

When a user opens Cosmos, what should they see first?

## Current behavior

| Entry path | First view |
|------------|------------|
| Ctrl+G / Cosmos view mode | Full spatial Cosmos (`NoteGraphView`) — graph/universe canvas |
| Context panel → Cosmos tab | Local neighborhood graph for active note |
| Dashboard → Open cosmos | Full Cosmos view |
| Dashboard → Open Discover | Discover tab in context panel |
| HUD → Open Discover | Discover tab in context panel |

## Analysis

**Graph-first (current default)** suits spatial exploration and matches the Cosmos metaphor (galaxies, stars, orbits). Users opening Cosmos expect to *see* their knowledge space.

**Discovery-first** suits proactive guidance but is better as an adjacent tab — not a replacement for spatial view. K-38 already surfaces discoveries via dashboard card and HUD counts.

**Insights-first** is note-scoped, not vault-scoped — wrong default for full Cosmos entry.

## Recommendation

Keep **spatial Cosmos as the default** when opening full Cosmos view.

Proactively guide users to Discovery via:

1. Dashboard "Today's discoveries" card (K-38) ✓
2. HUD discovery block with Open Discover (K-38) ✓
3. Unified suite header on Discover tab explaining the system (K-39) ✓

## Low-risk improvement implemented (K-39)

- HUD `aria-label` for accessibility
- Orbit icon consistency so Cosmos entry is visually distinct from generic "graph"
- Empty state copy already Cosmos-branded (`graphEmptyHeadline`)

## Not implemented (defer K-40)

- Auto-open Discover tab when entering Cosmos with pending high-confidence discoveries
- First-run Cosmos onboarding overlay
- Split-screen Cosmos + Discover layout

## Rationale

Auto-switching to Discover on Cosmos open would disorient users expecting spatial navigation. Discovery remains one click away via HUD and dashboard.
