# K-31 — Archive Recovery Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P0 — usefulness, navigation, discoverability

**Prior score:** 4/10 → **Target:** 5.5/10

---

## Audit Summary

| Dimension | Before | Issue |
| --------- | ------ | ----- |
| Usefulness | Low–medium | Heatmap visual; weak CTAs |
| Navigation | Partial | `openNote` + tab switch existed; placeholders dead-end |
| Discoverability | Poor | Mislabeled Analytics tab (fixed K-31 pass 1) |
| Click depth | High | Browse → trace requires knowledge of Notes lenses |
| Empty states | Weak | Hint only; no action |
| User value | 4/10 | Pretty shell, sparse payoff |

---

## Implemented (K-31 recovery)

| Improvement | Detail |
| ----------- | ------ |
| Empty home CTA | “Go to Notes to start writing” → `switchToNotesTab()` |
| Placeholder copy | i18n `archiveViewUnavailable` with guidance to Home / Notes |
| Placeholder labels | i18n period/area/timeline view names |
| Tab label | Archive / 아카이브 (pass 1) |

**Already wired (verified):**

- Mark day → `openTraceDayNavigation` + Notes tab
- Mark month → `openArchiveMarkMonthNavigation`
- Browse links → `openArchiveBrowseDestination`
- Milestones / areas → `openNote` + Notes tab

---

## Remaining Gaps

| Gap | Priority |
| --- | -------- |
| Period/Area/Timeline branches still placeholder-only | P1 |
| Heatmap cells without marks — no onboarding tooltip | P2 |
| English month labels in projection layer | P2 |
| Archive → Notes context (which lens opened) | P2 |

---

## Recommended Next Milestone

1. Ship Period branch as filtered trace range (reuse `RangeTraceLensView`).
2. Heatmap cell click → day trace with notes list preview.
3. Inline “what is a mark?” onboarding on first empty visit.

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Low-risk navigation improvements | Met |
| Reduced dead-end placeholders | Partial (copy improved) |
| Empty state action | Met |
