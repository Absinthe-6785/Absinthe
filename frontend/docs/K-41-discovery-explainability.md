# K-41 Discovery Explainability

**Branch:** `k41-cosmos-onboarding`

---

## Component: `WhyThisRecommendation`

Location: `cosmos/onboarding/WhyThisRecommendation.tsx`

Used in:

- **DiscoveryPanel** — all discovery cards
- **CosmosInsightsPanel** — suggested connections (signal bullets)

### Structure

```
Why
[Confidence badge]
• Reason line 1
• Reason line 2
Confidence: High · Score 72
```

---

## By Category

| Kind | Reason lines | Confidence |
|------|--------------|------------|
| Missing connection | Bullet per signal (shared tags, area, refs) | Badge + score |
| Forgotten knowledge | Tier + days inactive | Badge + score |
| Knowledge drift | Days since structure update | Badge + score |
| Emerging topic | Recent cluster count | Badge + score |
| Weak hub | Note count without hub | Badge + score |

Reason text from `discoveryReasons.ts` (K-40 bullets for connections).

---

## Trust Improvements (Task F)

Every discovery card now exposes:

- ✅ Confidence tier (badge + short label)
- ✅ Reasoning (Why block with bullets)
- ✅ Source signals (missing connection bullets)
- ✅ Score transparency (footer line)

No scoring changes — display only.

---

## Insights Parity

Suggested connections show the same Why pattern with signal labels from `suggestionSignalLabel`.

Opportunities retain action-oriented detail lines (unchanged).
