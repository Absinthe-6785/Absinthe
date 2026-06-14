# K-39 Discovery Quality Audit

Review of K-38 discovery engine output after K-39 calibration.

## Issues found (pre-K-39)

| Issue | Severity | Example |
|-------|----------|---------|
| Duplicate forgotten + drift for same note | High | History Hub in both sections |
| Low-value emerging topics (3 notes) | Medium | Noisy tag clusters |
| Weak hub + emerging topic overlap | Medium | Same area listed twice |
| Missing connection threshold too low (8) | Medium | Weak tag-only pairs surfaced |
| No confidence indicator | UX | User can't judge trust |
| No explicit reason lines | UX | Subtitle only, no "why" |

## Fixes applied (K-39)

### Scoring calibration (`discoveryScoring.ts`)

| Weight | K-38 | K-39 |
|--------|------|------|
| MIN_FORGOTTEN_DAYS | 30 | **45** |
| MIN_DRIFT_DAYS | 60 | **90** |
| MIN_CONNECTION_SCORE | 8 | **14** |
| EMERGING_MIN_NOTES | 3 | **4** |
| MIN_FEED_SCORE | — | **35** (new) |
| CONNECTION_RELEVANCE | 0.6 | **0.55** |

### Deduplication (`refineDiscoveryItems`)

- One activity item per note (forgotten OR drift, highest score wins)
- Skip emerging topic when weak hub exists for same area label
- Pair dedup for missing connections
- Filter items below MIN_FEED_SCORE

### Confidence tiers

| Tier | Threshold |
|------|-----------|
| High | score ≥ 85 |
| Medium | score ≥ 50 |
| Low | score < 50 |

Displayed on discovery cards; low-score items filtered before display.

### Reason lines (`discoveryReasons.ts`)

Each card shows structured reasons, e.g.:

- Forgotten: "Core hub inactive for 92 days (Core Hub)"
- Missing connection: "Overlap: Shared tags + Shared area"
- Weak hub: "24 notes without a major hub"

## Remaining noise risks (K-40)

- Tag-based emerging topics may still overlap semantically with galaxy clusters
- Missing connections limited to top 28 source notes — large vaults may miss pairs
- No user dismiss/snooze for discoveries

## Validation

Run Discover tab on vault with:

- History area + French tag cluster
- Orphan notes
- Stale hub notes (90+ days)

Expect fewer items, no duplicate hub entries, confidence badges on all cards.
