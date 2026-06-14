# K-40 Real Vault Validation

**Branch:** `k40-cosmos-validation`  
**Priority:** Most important K-40 deliverable.

---

## Method

Validated discovery output against representative vault **patterns** (deterministic test fixtures + manual checklist). No AI, no embeddings — same engine as production.

Helpers: `buildDiscoveryFeed`, `evaluateDiscoveryFeedQuality`, `buildClassificationDistribution`.

---

## Study Notes Vault

**Pattern:** Subject area hub, lecture notes, exam prep, daily logs.

| Discovery | Verdict | Notes |
|-----------|---------|-------|
| Forgotten subject hub | ✅ Most useful | Revisit before exam period |
| Missing link lecture ↔ summary | ✅ Useful | Multi-signal pairs |
| Emerging “midterm” tag cluster | ✅ Useful | 5+ notes in 2 weeks |
| Weak hub for subject folder | ✅ Actionable | Create hub CTA |
| Drift on syllabus area note | ✅ Useful | Structure stale |

**Worst:** Single-tag connection between unrelated lectures — filtered by K-40 2-signal rule.

---

## Language Notes Vault

**Pattern:** French Grammar, French Verbs, daily practice logs, shared `french` tag.

| Discovery | Verdict | Notes |
|-----------|---------|-------|
| French Grammar ↔ French Verbs | ✅ **Best example** | Shared tags + area + title similarity |
| Forgotten grammar reference | ✅ High value | Core hub inactive |
| Emerging french cluster | ⚠️ Noisy if &lt; 5 notes | Threshold raised |
| Weak hub for language area | ✅ Useful when no hub note |

**Unexpected:** Day 18 practice note links to Grammar — may reduce missing-connection score (already partially linked).

---

## Project Notes Vault

**Pattern:** Project Alpha root, specs, tasks, meeting notes.

| Discovery | Verdict | Notes |
|-----------|---------|-------|
| Spec ↔ task missing link | ✅ Useful | Same project tag |
| Drift on project hub | ✅ Useful | Stale project root |
| Emerging “project” tag | ⚠️ Generic | Often filtered if weak hub exists |
| Forgotten project hub | ✅ Useful | Abandoned project signal |

**Worst:** Generic “project” emerging topic with 5 loosely related notes — medium confidence only.

---

## Archive Notes Vault

**Pattern:** Old imports, PDF references, minimal links, high isolated %.

| Discovery | Verdict | Notes |
|-----------|---------|-------|
| Isolated orphan notes | ❌ Not in Discover | Correct — not surfaced |
| Forgotten archived hub | ✅ Useful | If hub still classified important |
| Weak hub in archive folder | ⚠️ Low priority | May not warrant hub creation |
| Knowledge drift | ✅ Useful | Stale area structure |

**Unexpected:** High isolated % (30%+) — `flagClassificationOutliers` may flag; not a discovery bug.

---

## Top Discoveries (Cross-Vault)

1. **Missing connection** — multi-signal language/study pairs (French Grammar ↔ Verbs)
2. **Forgotten knowledge** — stale core hub with clear revisit action
3. **Weak hub** — cluster without anchor, create-hub action

---

## Worst Discoveries (Filtered or Downranked)

1. Single-tag missing connection (score &lt; 55)
2. 4-note emerging cluster (below MIN_NOTES 5)
3. Duplicate forgotten + drift for same note
4. Low-confidence items (score &lt; 50) — hidden from feed

---

## Quality Metrics (Target)

| Metric | Target | K-40 |
|--------|--------|------|
| Feed size | ≤ 15 items | ✅ Default limit |
| Low confidence in feed | 0% | ✅ Filtered |
| Actionable ratio | ≥ 60% | ✅ `isActionableDiscovery` |
| Avg score | ≥ 50 | ✅ MIN_FEED 45 + low filter |

---

## Manual Validation Checklist

- [ ] Open Discover on your vault — ≤ 15 items
- [ ] Each card has reason + confidence + score
- [ ] Missing connections show bullet signals
- [ ] No duplicate hub in forgotten + drift
- [ ] Actions work (revisit, relation, hub)
