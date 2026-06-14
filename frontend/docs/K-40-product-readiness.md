# K-40 Product Readiness Scorecard

**Branch:** `k40-cosmos-validation`  
**Baseline:** K-39 Cosmos Unification

---

## Scores

| Area | K-39 | K-40 | Rationale |
|------|------|------|-----------|
| **Navigation** | 8.5 | **8.5** | Unchanged; Cosmos entry consistent |
| **Cosmos** | 8 | **8.5** | HUD i18n cleanup (`cosmosHud*`), validation pass |
| **Discovery** | 7 | **8.5** | Noise reduction, explainability, quality helpers |
| **Actions** | 8 | **8** | Unchanged; integrated with Discover |
| **NoteView** | 8 | **8** | Discover tab score transparency |
| **Localization** | 8.5 | **8.5** | k40 keys; graphHud aliases retained |
| **Accessibility** | 7.5 | **7.5** | HUD aria from K-39 |
| **Mobile** | 7 | **7** | Discover scroll; no mobile-specific pass |

---

## Overall Readiness

**8.0 → 8.4 / 10**

Cosmos Discovery moves from **experimental** to **production-ready** for vaults with linked notes and areas.

---

## K-40 Deliverables

- ✅ Discovery validation audit doc
- ✅ `discovery/validation/recommendationQuality.ts` + tests
- ✅ Noise reduction (thresholds, limits, low-confidence filter)
- ✅ Classification audit doc + distribution helper
- ✅ Explainability (bullet reasons, score line)
- ✅ UX / first-run / real-vault audit docs
- ✅ Safe naming: `cosmosHud*`, `onOpenCosmos`
- ✅ Product readiness scorecard

---

## Top Remaining Blockers

1. Discovery dismiss/snooze
2. First-run guided hints for Cosmos metaphor
3. NoteView full localization gaps (pre-existing)
4. Mobile Cosmos HUD density

---

## Recommended K-41 Roadmap

1. **Discovery feedback loop** — dismiss, snooze, “not relevant” (local only)
2. **First-run Cosmos hints** — empty Discover copy, optional tooltip
3. **Classification transparency** — “Why this tier?” in Insights
4. **Discover keyboard shortcut** — quick access from NoteView
5. **Vault-scale connection scan** — optional deeper pass for large vaults (deterministic, capped)
6. **Mobile Discover** — compact card layout, sticky actions

**Explicitly out of scope:** AI, embeddings, vector search, renderer redesign.
