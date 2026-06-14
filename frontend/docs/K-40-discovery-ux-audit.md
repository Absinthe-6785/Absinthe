# K-40 Discovery UX Audit

**Branch:** `k40-cosmos-validation`

---

## Surfaces Reviewed

| Surface | Location | Purpose |
|---------|----------|---------|
| Discover panel | NoteView right panel → Discover tab | Full categorized feed |
| Dashboard card | Unified workspace dashboard | Summary counts + top items |
| HUD section | NoteGraphView Cosmos HUD | Counts + Open Discover |
| Search integration | Workspace search palette | `discoveryOpportunity` badge |

---

## Information Duplication

| Duplication | Severity | Recommendation |
|-------------|----------|----------------|
| HUD counts vs dashboard card counts | Low | Same source (`buildDiscoveryFeed`) — acceptable |
| Discover tab vs Insights opportunities | Medium | Different engines; Insights = note-scoped, Discover = vault-wide |
| Search badge vs Discover panel item | Low | Badge is entry point only |
| Confidence badge + footer confidence text (K-40) | Low | Badge for scan; footer for score transparency |

**Verdict:** No critical duplication. Dashboard + HUD are complementary entry points.

---

## Ranking Obviousness

| Element | Clear? | Notes |
|---------|--------|-------|
| Section order (forgotten → connections → …) | ✅ | Fixed priority by kind |
| Within-section sort by score | ⚠️ | Score shown in K-40 footer |
| Dashboard card top 3 | ✅ | Highest score items |
| Confidence badge color | ✅ | High/medium/low from K-39 |

**K-40 improvement:** Score + confidence line on each Discover card.

---

## Action Discoverability

| Discovery kind | Action | Visible? |
|----------------|--------|----------|
| Forgotten / drift | Revisit note | ✅ Primary button |
| Missing connection | Open + Create relation | ✅ Two buttons |
| Weak hub | Create hub | ✅ Primary button |
| Emerging topic | Open sample note | ✅ |

**Gap:** No “dismiss” or “not relevant” — deferred to K-41.

---

## UX Findings Summary

1. **Strengths:** Unified Cosmos suite header, reason blocks, confidence badges, one-click actions
2. **Weaknesses:** Ranking implicit until K-40 score line; no dismiss; mobile Discover tab scroll length
3. **K-40 changes:** Bullet reason lines for connections; score transparency; fewer items (4/section, 15 total)

---

## Mobile

- Discover tab scrolls vertically — acceptable
- Action buttons stack on narrow cards — OK
- HUD discovery section may truncate on small Cosmos view — monitor in K-41
