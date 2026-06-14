# K-43 Design Language Review

Post-K-34 Cosmos terminology and visual language alignment check.

---

## Typography scale (knowledge/cosmos)

| Size | Usage |
|------|--------|
| 8px | Filter pills, micro badges |
| 9px | Tab labels, hints, CTAs |
| 10px | Section headers, muted body |
| 11px | Card titles, panel rows |
| 12px | Search titles, snapshot labels |
| 13–14px | Onboarding heroes |
| 16px | Dashboard page title |

Title weight: 600–700 interactive; 800 for heroes.

---

## Shared primitives

| Primitive | File | Role |
|-----------|------|------|
| `KnowledgePanelSection` | `KnowledgePanelSection.tsx` | Uppercase 10px section headers + count |
| `KnowledgePanelEmpty` | same | Centered 11px faint empty |
| `CosmosEmptyStatePanel` | onboarding | Gradient onboarding blocks |
| `CosmosSuiteHeader` | `cosmosPanelUi.tsx` | Gradient suite title bar |
| Dashboard widgets | `TimelineDashboardCard`, `DiscoveryDashboardCard` | `cardHov` + 8px radius + 9px CTA |

---

## Badge inconsistency (documented, not changed)

| Surface | Importance display |
|---------|-------------------|
| Workspace search | Accent pill |
| Insights panel | 12px accent text |
| Discovery kind | Uppercase faint label (no pill) |

Recommendation: unify to pill OR text-only per semantic tier (K-44).

---

## Empty state patterns

1. Faint inline — dashboard lists
2. `KnowledgePanelEmpty` — cosmos panels
3. `CosmosEmptyStatePanel` — onboarding scenarios
4. Silent `null` — timeline/discovery dashboard cards when count = 0

K-43 did not add placeholder cards for hidden timeline/discovery widgets (documented in dashboard audit).

---

## Spacing rhythm

- Card padding: 10–12px horizontal
- Section margin: 6–12px vertical between blocks
- Panel inset: `0 8px` / `0 10px`

No spacing changes in K-43 — audit confirms consistency with K-35/K-39 patterns.
