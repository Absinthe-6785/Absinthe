# K-41 Mobile Adoption Review

**Branch:** `k41-cosmos-onboarding`

---

## Onboarding States

| Element | Mobile assessment |
|---------|-------------------|
| Cosmos empty overlay | Centered text readable; CTAs full-width friendly |
| CosmosStartDashboard | Buttons use `touchMinSize` (44px min) |
| CosmosProductTour | Skip/Next buttons touch-friendly |
| FirstDiscoveryBanner | Dismiss × target adequate; text wraps |

---

## Discovery Cards

| Element | Change |
|---------|--------|
| Action buttons | `minHeight: touchMinSize` via compact prop path |
| Why block | Compact font 9px — readable on phone |
| Score line | 8px — acceptable secondary text |

**Recommendation (K-42):** Stack actions horizontally on wide cards only; keep vertical stack on mobile (current).

---

## Tooltips

| Element | Note |
|---------|------|
| CosmosTermTooltip | Native `title` — works on long-press mobile |
| Why this tier? | Tap to expand — no hover required ✅ |
| Search tier hint | Inline text — no hover required ✅ |

---

## Actions

- Revisit / Open / Create relation — secondary buttons 9px font; touch min applied
- Create hub — same

---

## Findings

| Issue | Severity | Status |
|-------|----------|--------|
| Tour on mobile dashboard | Low | OK — compact padding |
| Glossary title tooltips | Low | Long-press only — acceptable |
| Discovery card density | Medium | Monitor — K-42 compact card mode |

---

## Verdict

Mobile adoption **acceptable** for K-41. Touch targets improved on primary CTAs and discovery actions.
