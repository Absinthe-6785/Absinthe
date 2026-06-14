# K-40 Discovery Validation Audit

**Branch:** `k40-cosmos-validation`  
**Scope:** All five discovery categories against synthetic and representative vault patterns.

---

## Method

Audited `discoveryEngine`, `discoverySignals`, and `recommendationQuality` helpers against:

- Test vault (History hub + French cluster + orphan)
- Study / language / project / archive note patterns (see [K-40-real-vault-validation.md](./K-40-real-vault-validation.md))
- K-39 baseline issues from [K-39-discovery-quality-audit.md](./K-39-discovery-quality-audit.md)

---

## Forgotten Knowledge

| Finding | Type | Example |
|---------|------|---------|
| Stale core/major hub after 45+ days | True positive | History Hub, 92 days since open |
| Recently opened hub | False positive (filtered) | Hub opened within 30 days — below MIN_FORGOTTEN_DAYS |
| Supporting note with old timestamp | False positive (filtered) | Only core/major hubs scanned |
| Duplicate with knowledge drift | Duplicate (fixed) | Same note in forgotten + drift — dedup keeps highest score |

**Noise after K-40:** Low-confidence forgotten items excluded from feed (score &lt; 50).

---

## Missing Connections

| Finding | Type | Example |
|---------|------|---------|
| French Grammar ↔ French Verbs (shared tag + area) | True positive | Multi-signal pair, score ≥ 55 |
| Tag-only weak pair | False positive (filtered) | Single shared tag, score &lt; 55 — requires 2+ signals |
| Already linked notes | False positive (filtered) | `hasExistingLink` check |
| Reverse duplicate A↔B | Duplicate (fixed) | Pair key dedup |

**Example reason block (K-40):**

```
French Grammar ↔ French Verbs
Reason:
• Shared tags
• Same area
• Title similarity
Confidence: Medium · Score 62
```

---

## Emerging Topics

| Finding | Type | Example |
|---------|------|---------|
| 5+ notes in tag cluster within 14 days | True positive | `french` tag cluster |
| 3–4 note cluster | False positive (filtered) | EMERGING_MIN_NOTES raised to **5** |
| Same area as weak hub | Duplicate (fixed) | Emerging skipped when weak hub exists for area |
| Tag cluster + galaxy cluster same label | Noisy overlap | Both may score; weak-hub dedup reduces one |

---

## Weak Hubs

| Finding | Type | Example |
|---------|------|---------|
| Galaxy with 8+ notes, no major hub | True positive | Area health gap `missing-hub` |
| Small folder (2 notes) | False positive (filtered) | Below gap threshold |
| Actionable create-hub CTA | True positive | One-click hub creation |

---

## Knowledge Drift

| Finding | Type | Example |
|---------|------|---------|
| Hub not updated 90+ days | True positive | Area note stale structure |
| Same note as forgotten | Duplicate (fixed) | Keeps higher-scoring kind only |
| Low-importance satellite | False positive (filtered) | Only hubs + core/major importance |

---

## K-40 Calibration Changes

| Parameter | K-39 | K-40 |
|-----------|------|------|
| MIN_FEED_SCORE | 35 | **45** |
| MIN_CONNECTION_SCORE | 14 | **18** |
| MIN_CONNECTION_SIGNALS | — | **2** (or score ≥ 55) |
| EMERGING_MIN_NOTES | 4 | **5** |
| perSectionLimit default | 6 | **4** |
| totalLimit default | 30 | **15** |
| Low confidence in feed | shown | **hidden** |

---

## Duplicate Rate (static)

Use `evaluateDiscoveryFeedQuality(feed, rawCount)`:

- Forgotten/drift dedup per note
- Missing-connection pair dedup
- Emerging/weak-hub area overlap skip

Target: duplicate rate ≥ 0.15 when raw candidates exceed feed size.

---

## Remaining Risks (K-41)

- No dismiss/snooze for discoveries
- Large vaults: connection scan limited to top 28 source notes
- Tag/galaxy emerging overlap not fully merged semantically
