# K-40 Classification Audit

**Branch:** `k40-cosmos-validation`  
**Engine:** `knowledgeImportance.ts` via `buildClassificationDistribution()`

---

## Expected Distribution

| Classification | Expected % | Role |
|----------------|------------|------|
| Core Hub | 1–5% | Vault anchors, area hubs, high connectivity |
| Major Hub | 5–15% | Strong connectors, frequently referenced |
| Supporting | 20–40% | Linked notes with moderate role |
| Satellite | Largest group | Periphery notes with some links |
| Isolated | 5–25% | No meaningful connections |

Reference ranges: `CLASSIFICATION_EXPECTED_RANGES` in `discovery/validation/recommendationQuality.ts`.

---

## Synthetic Test Vault (7 notes)

| Note | Classification | Rationale |
|------|----------------|-----------|
| History (area) | Core/Major hub | Area note, backlinks |
| History Hub | Core hub | Links to area, high importance |
| French Grammar / Verbs / Day 18 | Satellite/Supporting | Tag cluster, some links |
| Project Alpha | Satellite | Single project tag |
| Orphan | Isolated | No links |

**Distribution (approximate):** Core 1–2, Major 0–1, Supporting 1–2, Satellite 2–3, Isolated 1.

Within expected ranges for a small vault.

---

## Vault-Type Expectations

### Study notes

- More **supporting** and **satellite** (lecture notes, daily logs)
- 1–2 **core hubs** per subject area
- Risk: over-classifying daily notes as hubs if over-linked

### Language notes

- Tag clusters → **satellite** density high
- Grammar reference note may become **major hub** if heavily backlinked
- French cluster test: weak-hub discovery when no hub note exists

### Project notes

- Project root → **major hub**
- Task/spec notes → **supporting/satellite**
- Isolated drafts common in early project phase

### Archive notes

- Higher **isolated** % (old imports, unlinked PDFs)
- Stale hubs → forgotten-knowledge + drift signals
- May exceed isolated range (25%+) — flag with `flagClassificationOutliers()`

---

## Audit Findings

| Check | Status | Notes |
|-------|--------|-------|
| Core hub rate not inflated | ✅ | Only high importance + connectivity |
| Satellite is largest bucket | ✅ | Typical PKM vaults |
| Isolated not dominating active vault | ⚠️ | New users may see 30%+ isolated until linking |
| Classification matches Cosmos tiers (star/planet/moon) | ✅ | Mapped in graph renderer |

---

## Outlier Detection

`flagClassificationOutliers(distribution)` returns classifications outside expected min/max.

**Example outlier:** 80% core-hub on 10-note vault → mis-linked or over-weighted importance inputs.

---

## K-41 Recommendations

- Surface classification % in Cosmos HUD (read-only)
- Explain tier in note Insights panel (“Why satellite?”)
- Do not auto-reclassify — deterministic rules only
