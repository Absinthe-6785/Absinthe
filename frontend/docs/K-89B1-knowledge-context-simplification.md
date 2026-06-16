# K-89B1 — Knowledge Context Simplification

**Branch:** `k89b1-knowledge-context-simplification`  
**Status:** Complete  
**Scope:** Promote Discover to primary context navigation (K-89B Option B)  
**Constraint:** Navigation only — no discovery engine, ranking, or collector changes

---

## Executive Summary

Implemented K-89B audit **Option B**: swapped **Discover** into the primary tab strip and moved **Insights** to the More menu. Primary tab count remains **5**; total surfaces remain **11**.

Users can reach vault-wide rediscovery with **one click** on the context tab bar instead of opening More first.

**Deferred to K-89B2:** Tags tab removal (Properties does not yet expose tag add/remove/rename), Metadata dropdown for Relations/Stats.

---

## A. Changes Made

| File | Change |
|------|--------|
| `KnowledgeContextPanel.tsx` | `KNOWLEDGE_CONTEXT_PRIMARY_TABS`: `insights` → `discover` |
| `useNoteViewPanelConfig.tsx` | Tab definition order: primary keys first (`discover` before `properties`), Insights moved after Properties |
| `knowledgeContextIa.test.ts` | Regression tests for primary/More split and discover scope |

**Unchanged (by design):**

- `discoveryEngine.ts`, collectors, scoring — K-89D1 authoritative
- `NoteContextPanelBody.tsx` routing — same tab keys
- `contextPanelTabGate.ts` — lazy-load gates unchanged
- `handleOpenDiscover` — still opens `discover` tab

---

## B. Before / After Structure

### Before (K-81 / pre-B1)

```text
Primary: Outline | Links | Cosmos | Insights | Properties
More:    Actions | Discover | Timeline | Tags | Relations | Stats
```

### After (K-89B1)

```text
Primary: Outline | Links | Cosmos | Discover | Properties
More:    Insights | Actions | Timeline | Tags | Relations | Stats
```

| Metric | Before | After |
|--------|--------|-------|
| Primary tabs | 5 | 5 |
| More items | 6 | 6 |
| Total surfaces | 11 | 11 |
| Discover visible without More | No | **Yes** |

---

## C. Navigation Validation

Workflow comparison (panel already open; +1 if panel collapsed).

| Workflow | Before (clicks / tab changes) | After | Δ |
|----------|------------------------------|-------|---|
| Open note → vault forgotten knowledge | More → Discover (**2–3**) | **Discover tab (1)** | **−1 to −2** |
| Open note → per-note related notes | Links (**1**) | Links (**1**) | 0 |
| Open note → per-note intelligence | Insights (**1**) | More → Insights (**2**) | +1 |
| Open note → metadata properties | Properties (**1**) | Properties (**1**) | 0 |
| Open note → typed relations | More → Relations (**2**) | More → Relations (**2**) | 0 |
| Sidebar dashboard → discovery | Card → Discover (**1**) | Card → Discover (**1**) | 0 |
| Return to editor from Discover | Click editor (**0–1**) | Same | 0 |

**Net:** Vault rediscovery — the audit’s highest-friction path — improves by **1–2 interactions**. Per-note Insights pays one extra click; acceptable trade for promoting vault-wide Discover.

---

## D. Metadata & More Menu Decisions

### Tags tab — deferred (K-89B2)

**Audit assumption:** Tags ⊂ Properties.

**Code reality:** `NotePropertiesPanel` edits user property rows only. `NoteTagsPanel` provides tag add/remove/rename and vault tag cloud. **Removing Tags would drop tag editing** — not low-risk.

**K-89B2 candidate:** Embed `NoteTagsPanel` tag editor section inside Properties, then remove Tags tab.

### Relations — remains in More

Relations outranks Stats/Timeline/Actions for structured linking but overlaps partially with Links wiki edges. Promoting Relations would require demoting another primary tab (6-primary crowding on tablet) or Metadata dropdown (Option E).

**Decision:** Keep Relations in More; document Metadata group for K-89B3.

### More menu role (post-B1)

| More item | Role |
|-----------|------|
| **Insights** | Per-note intelligence (demoted primary) |
| **Actions** | Power-user cosmos plan |
| **Timeline** | Historical / evolution lens |
| **Tags** | Tag CRUD + vault browse (until B2) |
| **Relations** | Typed edges |
| **Stats** | Read-only counts + tag cloud |

More = **secondary tools**; primary strip = **daily workflows** (navigate, connect, rediscover, describe).

---

## E. Regression Tests

`knowledgeContextIa.test.ts`:

- Discover in `KNOWLEDGE_CONTEXT_PRIMARY_TABS`
- Insights not primary
- Five primary / eleven total tabs
- More contains Insights, not Discover
- `resolveDashboardLoadScope` loads discover feed when Discover tab active
- Insights gate unchanged when Insights tab active

```bash
cd frontend
npm test -- knowledgeContextIa
```

---

## F. Success Criteria

| Criterion | Met |
|-----------|-----|
| Discover reachable without More | ✅ |
| No new tabs | ✅ |
| No discovery logic changes | ✅ |
| No Cosmos / Related Notes redesign | ✅ |
| Regression tests | ✅ |

---

## G. Follow-Up

| Branch | Scope |
|--------|-------|
| **K-89B2** | Tags → Properties embed; discovery surface dedupe (K-89B audit Option D) |
| **K-89B3** | Metadata dropdown; Relations/Stats grouping; navigation polish |

---

## References

- `K-89B-knowledge-context-ia-audit.md` — audit rationale
- `K-81-notes-workflow-refinement.md` — prior primary/More split
- `K-89D1-discovery-feed-performance.md` — feed perf (unchanged)
