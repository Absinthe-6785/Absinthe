# K-41 Cosmos Onboarding

**Branch:** `k41-cosmos-onboarding`

---

## Architecture

Onboarding lives in `cosmos/onboarding/` — no new intelligence, scoring, or graph engine changes.

```
cosmos/onboarding/
├── cosmosVaultState.ts      # Vault phase detection (no-notes → has-discoveries)
├── cosmosOnboardingStorage.ts  # localStorage: first discovery, product tour
├── tierExplanation.ts       # Deterministic tier factor lines
├── CosmosEmptyStatePanel.tsx
├── CosmosStartDashboard.tsx
├── FirstDiscoveryBanner.tsx
├── CosmosProductTour.tsx
├── WhyThisRecommendation.tsx
├── WhyThisTier.tsx
└── CosmosTermTooltip.tsx
```

**Integration points:**

| Surface | Component / logic |
|---------|-------------------|
| Cosmos graph | `NoteGraphView` — phase-specific empty overlay + CTAs |
| Discover panel | `DiscoveryPanel` — healthy empty, first discovery banner, `WhyThisRecommendation` |
| Insights panel | `CosmosInsightsPanel` — `WhyThisTier`, signal reasons |
| Workspace search | `buildWorkspaceSearch` — `tierHint` metadata |
| Dashboard | `UnifiedWorkspaceDashboard` — `CosmosStartDashboard`, `CosmosProductTour` |
| Suite header | `CosmosSuiteHeader` — glossary tooltips |

---

## Vault Phases

| Phase | Condition |
|-------|-----------|
| `no-notes` | Zero active notes |
| `no-links` | Notes exist, zero graph edges |
| `linked-healthy` | Linked vault, zero discoveries |
| `has-discoveries` | Discovery feed non-empty |

---

## Local Persistence

Key: `absinthe:cosmos-onboarding:v1`

- `firstDiscoveryCelebrated` — dismiss first discovery banner
- `productTourCompleted` — skip/complete 4-step tour
- `productTourStep` — resume tour progress

---

## Success Criteria Mapping

| Criterion | Implementation |
|-----------|----------------|
| Understand Cosmos | Empty states, tour step 3, glossary tooltips |
| Understand Discovery | First discovery banner, Why blocks, tour step 4 |
| Understand tiers | WhyThisTier in Insights + search metadata |
| Understand recommendations | WhyThisRecommendation on all discovery cards |
| Approachable | Non-modal, skippable, fewer jargon-only labels |
