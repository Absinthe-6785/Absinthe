# K-89B2 — Discovery Surface Consolidation Audit

**Branch:** `k89b2-discovery-surface-consolidation`  
**Status:** Audit complete — no consolidation code shipped  
**Scope:** Discovery surface inventory, overlap analysis, canonical contracts, migration plan  
**Constraint:** No Discover/Links/Related Notes redesign; no tab-count increase

**Prerequisites:** K-89B IA audit, K-89B1 (Discover promoted to primary), K-89D/D1 (feed perf + collector audit)

---

## Executive Summary

After K-89B1, **vault rediscovery is one click** (Discover primary tab). Remaining friction is **semantic overlap**, not navigation depth:

| Problem | Severity |
|---------|----------|
| Connection suggestions in **three places** (Insights, Actions, Discover) | **High** |
| Dual entry to same Discover feed (sidebar card, Cosmos HUD, primary tab) | **Medium** |
| Worth Revisiting vs Forgotten Knowledge — similar intent, different engines | **Medium** |
| Dashboard `leastRevisited` vs Discover inactivity collectors | **Medium** |

**Canonical contract (validated):**

| Surface | Responsibility |
|---------|----------------|
| **Links** | Per-note connections (navigate + link) |
| **Discover** | Vault-wide rediscovery (forget, connect, hygiene) |
| **Insights** | Per-note analysis & interpretation (gaps, tier, opportunities) |
| **Actions** | Executable per-note plan (power-user) |
| **Properties** | Metadata |

Recommended next implementation (**K-89B2B**): remove duplicate connection **presentation** from Insights/Actions; keep engines; add cross-links to Discover. **Low risk**, no tab changes.

---

## A. Discovery Surface Audit

### A.1 Inventory

| Surface | Location | Purpose | Inputs | Outputs | User intent |
|---------|----------|---------|--------|---------|-------------|
| **Links (Connections)** | Primary tab → `LinksContextPanel.tsx` | Per-note linking hub | Active note, index edges | Related, backlinks, references UI | “What connects to **this** note?” |
| **Most Related** | `RelatedNotesPanel.tsx` → `mostRelated` | Top contextual neighbors | `getRelatedNotes` index pool | Up to 6 ranked cards | “Jump to the best related note **now**” |
| **Worth Revisiting** | `RelatedNotesPanel.tsx` → `worthRevisiting` | Stale neighbors | Same pool + inlink/recency sort | Up to 6 cards (collapsed if Most Related full) | “What around this note should I **revisit**?” |
| **Discover tab** | Primary tab → `DiscoveryPanel.tsx` | Vault-wide feed | All notes, index, galaxy map, history | 6 section types, top 18 items | “What am I **forgetting** vault-wide?” |
| **Insights tab** | More → `CosmosInsightsPanel.tsx` | Per-note intelligence | Active note + vault context | Tier, gaps, **suggested connections**, opportunities | “What does **this** note **mean** in the vault?” |
| **Actions tab** | More → `CosmosActionsPanel.tsx` | Actionable plan | `NoteIntelligenceSnapshot` + area health | Connect/area/hub/relation actions + **connection list** | “What should I **do** with this note?” |
| **Discovery dashboard card** | Sidebar dashboard → `DiscoveryDashboardCard.tsx` | Feed summary + CTA | `DiscoveryFeed.summary` | Counts + “Open Discover” | “Are there vault opportunities?” (entry) |
| **Knowledge Review** | Sidebar dashboard → `KnowledgeReviewPanel.tsx` | Lightweight lists | All notes `updatedAt` / link counts | recentlyEdited, mostLinked, leastRevisited | “Quick vault browse” |
| **Cosmos HUD** | Full graph → `NoteGraphView.tsx` | Spatial + vault snapshot | `buildCosmosVaultAnalysis` + `buildDiscoveryFeed` | Isolated/opportunity counts + Discover CTA | “Vault health while exploring graph” |

### A.2 Engine map

| Engine | File | Used by |
|--------|------|---------|
| `groupRelatedNotes` | `related/groupRelatedNotes.ts` | Links → Most Related, Worth Revisiting |
| `buildDiscoveryFeed` | `discovery/discoveryEngine.ts` | Discover tab, dashboard scope, Cosmos HUD, search palette (fallback) |
| `buildDiscoveryConnectionSuggestions` | `discovery/discoveryConnectionSuggestions.ts` | Discover → missing-connection collector |
| `buildSuggestedConnections` | `cosmos/intelligence/suggestedConnections.ts` | Insights snapshot, Actions enrichment |
| `buildNoteIntelligenceSnapshot` | `cosmos/intelligence/cosmosAnalysis.ts` | Insights, Actions (input) |
| `buildCosmosActionPlan` | `cosmos/actions/actionEngine.ts` | Actions tab |
| `buildKnowledgeReviewLists` | `review/buildKnowledgeReview.ts` | Dashboard Knowledge Review |
| `worthRevisitingScore` | `groupRelatedNotes.ts` | Worth Revisiting only |

**Pipeline separation (K-89D):** `groupRelatedNotes` is **not** in the discovery feed pipeline. Per-note path stays &lt;1 ms at all scales.

### A.3 User intent mapping

```text
Intent                          → Canonical surface
─────────────────────────────────────────────────────────
Navigate this note's structure  → Outline
Follow/note connections         → Links
See spatial neighborhood        → Cosmos (context graph)
Find forgotten vault knowledge  → Discover
Inspect/edit metadata           → Properties
Interpret this note's role      → Insights
Execute structured cosmos ops   → Actions
Browse vault by recency/links   → Dashboard Review (sidebar)
```

---

## B. Overlap Analysis

### B.1 Pairwise matrix

| Pair | Duplicate information? | Duplicate navigation? | Duplicate signals? | Severity |
|------|---------------------|----------------------|-------------------|----------|
| **Links ↔ Discover** | Partial (both show “related” notes) | No — different tabs, clear scopes | No — index vs feed collectors | **Low** |
| **Most Related ↔ Discover** | Low — different ranking | No | No | **Low** |
| **Worth Revisiting ↔ Discover Forgotten** | Medium — revisitation theme | No | Yes — inactivity family | **Medium** |
| **Discover ↔ Insights** | **High** — connection suggestions | No (post-B1) | **Yes** — shared suggestion logic | **High** |
| **Discover ↔ Actions** | **High** — connection recommendations | No | **Yes** — Actions uses snapshot suggestions | **High** |
| **Insights ↔ Actions** | **High** — same snapshot blocks | Same More menu | **Yes** — snapshot → plan | **High** |
| **Discover tab ↔ Dashboard card** | **High** — same summary counts | **Yes** — two entry paths | Same `buildDiscoveryFeed` | **Medium** |
| **Discover tab ↔ Cosmos HUD** | **High** — discovery block counts | **Yes** — graph → edit mode switch | Same feed build (often **twice**) | **Medium** |
| **Discover ↔ Knowledge Review** | Medium — leastRevisited vs forgotten | Partial | Partial (`updatedAt` vs `lastOpenedAt`) | **Medium** |

### B.2 Measured collector overlap (K-89D @ 3000 notes)

| Pair | Shared note IDs | Overlap % |
|------|----------------:|----------:|
| Forgotten ↔ Knowledge Drift | 12 | **57.1%** |
| Forgotten ↔ Missing-connection | 0 | 0% |
| Drift ↔ Missing-connection | 0 | 0% |

*UI surfaces Worth Revisiting and Forgotten have **0%** feed collector overlap — different scopes; qualitative overlap only.*

### B.3 Triple overlap: connection suggestions

```text
buildSuggestedConnections (per-note, full scan)
        ↓
Insights → "Suggested Connections" section
        ↓
Actions  → ConnectionRecommendationList (enriched)

buildDiscoveryConnectionSuggestions (indexed, vault sources)
        ↓
Discover → "Missing Connections" section
```

**User confusion:** “Where do I find link suggestions?” — answer should be:

- **This note** → Links (existing neighbors) or Insights (gaps only, post-consolidation)
- **Vault-wide** → Discover → Missing Connections

---

## C. Canonical Responsibilities (contract)

| Surface | Equals | Does NOT equal |
|---------|--------|----------------|
| **Links** | Per-note connections (navigate, backlink, reference) | Vault-wide hygiene scan |
| **Discover** | Vault-wide rediscovery feed | Per-note related ranking |
| **Insights** | Analysis & interpretation for active note | Vault feed duplicate |
| **Actions** | Executable cosmos plan | Primary discovery surface |
| **Properties** | Metadata & classification | Discovery or linking |
| **Cosmos (context tab)** | Local graph around active note | Full vault Discover |
| **Dashboard card** | Entry pointer to Discover | Second feed UI |

**Validated:** K-89B audit contract holds post-B1. **Gap:** Insights and Actions still **present** vault-style connection suggestions at per-note scope.

---

## D. Discovery UX Review

### D.1 Workflows (post–K-89B1, panel open)

| Workflow | Path | Clicks / tab changes | Confusion risk |
|----------|------|----------------------|----------------|
| Reading note → **related knowledge** | Links → Most Related | **1** | Low — canonical |
| Reading note → **stale neighbors** | Links → Worth Revisiting (may be collapsed) | **1–2** | Medium — collapse hides section |
| Reading note → **forgotten vault hubs** | **Discover tab** | **1** | Low — fixed by B1 |
| Reading note → **link suggestions** | More → Insights **or** Actions **or** Discover | **2–3** | **High** — three paths |
| Reading note → **note importance/gaps** | More → Insights | **2** | Low — clear scope |
| Reading note → **connect/assign area** | More → Actions | **2** | Medium — overlaps Insights |
| Dashboard → discovery | Overview card → Discover | **1–2** | Medium — duplicate entry narrative |
| Cosmos graph → discovery | HUD button → Discover (mode switch) | **2+** | Medium — context break |

### D.2 Before / after K-89B1 (vault rediscovery)

| Metric | Pre-B1 | Post-B1 | Post-B2B (proposed) |
|--------|--------|---------|---------------------|
| Clicks to Discover feed | 2–3 (More) | **1** | **1** |
| Surfaces showing connection suggestions | 3 | 3 | **1 primary + Links neighbors** |
| Duplicate feed builds (HUD + dashboard) | 2+ paths | 2+ paths | **1 shared memo** (proposed) |

### D.3 Confusion points (ranked)

1. **Three connection suggestion UIs** (Insights, Actions, Discover)
2. **Worth Revisiting collapsed** when Most Related populated
3. **Dashboard leastRevisited** vs Discover Forgotten — different metrics, similar label
4. **Cosmos HUD** rebuilds discovery feed independently of dashboard
5. **Insights demoted** — users seeking “smart analysis” must open More

---

## E. Consolidation Proposal

### E.1 Recommended structure (K-89B2B)

**Navigation:** unchanged from K-89B1 (no tab add/remove).

**Presentation consolidation:**

| Change | Rationale |
|--------|-----------|
| **Insights:** Replace Suggested Connections list with compact “N vault suggestions in Discover →” link when count &gt; 0; keep gaps/opportunities/tier | Removes duplicate list; preserves analysis |
| **Actions:** Remove `ConnectionRecommendationList`; keep connect/area/hub/relation **actions** only; link to Discover for browse | Actions = execute, not browse |
| **Dashboard card:** Keep as entry CTA; add subtitle “Opens Discover tab” | Clarifies role (pointer, not second feed) |
| **Cosmos HUD:** Pass shared `discoveryFeed` prop; stop idle `buildDiscoveryFeed` if parent memo exists | Dedupe compute (K-89D3) |
| **WorkspaceSearchPalette:** Require `discoveryFeed` prop from `NoteView` (remove fallback rebuild) | Dedupe compute |
| **Worth Revisiting:** Consider `defaultCollapsed: false` when section has items and Most Related &lt; 3 | Low-risk discoverability win |

**Terminology (K-89B2A):** Optional copy pass — “Suggested Connections” → “Link opportunities (this note)” in Insights; Discover keeps “Missing Connections”.

### E.2 Alternative structures

| Alternative | Description | Tradeoff |
|-------------|-------------|----------|
| **Alt 1 — Links strip** | 2-item Discover preview strip at top of Links Connections | Surfaces vault picks without opening Discover; adds UI density to Links |
| **Alt 2 — Merge Insights into Discover** | Per-note snapshot as Discover sub-panel when note active | Conflates scopes; **high risk** — rejected |
| **Alt 3 — Remove dashboard card** | Discover primary tab only | Saves sidebar space; loses dashboard-at-a-glance |
| **Alt 4 — Remove Knowledge Review leastRevisited** | Single inactivity path via Discover | Cleaner; loses quick sort affordance |

**Preferred:** **E.1 (presentation dedupe)** + optional **Alt 1** in K-89B3 if user testing shows Links→Discover gap.

### E.3 What we explicitly do NOT consolidate

- **Most Related** — unique index path, core navigation
- **Discover feed collectors** — K-89D1 ranking preserved
- **Backlinks / References** — unique Links content
- **Insights gaps/opportunities** — unique per-note analysis

---

## F. Migration Assessment

### Low risk

| Change | Files (indicative) | Risk |
|--------|-------------------|------|
| Insights: link-to-Discover instead of connection list | `CosmosInsightsPanel.tsx` | **Low** — UI only |
| Actions: hide connection list, keep action buttons | `CosmosActionsPanel.tsx` | **Low** |
| Pass `discoveryFeed` to search palette (remove fallback) | `NoteView.tsx`, `WorkspaceSearchPalette.tsx` | **Low** |
| Dashboard card copy clarification | `DiscoveryDashboardCard.tsx`, i18n | **Low** |
| Worth Revisiting default expand tweak | `RelatedNotesPanel.tsx` | **Low** |

### Medium risk

| Change | Risk |
|--------|------|
| Cosmos HUD shared feed injection | Graph mount lifecycle; idle callback ordering |
| Remove Knowledge Review `leastRevisited` | User workflow change |
| Links “vault picks” strip | Layout + feed subscription when Links open |
| i18n terminology sweep (B2A) | Translation consistency across locales |

### High risk

| Change | Risk |
|--------|------|
| Merge Discover + Links tabs | Breaks per-note O(1) path; constraint violation |
| Remove Discover collectors / change ranking | K-89D1 regression |
| Remove Actions tab entirely | Power-user capability loss |
| Add new tab for “unified discovery” | Tab count increase — forbidden |

---

## G. Follow-Up Branches

| Branch | Scope | Addresses |
|--------|-------|-----------|
| **K-89B2A — Discovery Terminology** | i18n/copy: clarify Links vs Discover vs Insights labels; tooltips on dashboard card | Confusion point #1, #3 |
| **K-89B2B — Discovery Presentation Consolidation** | Implement E.1: dedupe connection lists, shared feed memo, palette prop | Overlap high-severity |
| **K-89B3 — Metadata Surface Polish** | Tags → Properties embed; Relations Metadata group; Worth Revisiting policy | K-89B IA deferred items |

Optional later:

| Branch | Scope |
|--------|-------|
| **K-89D2** | Collector merge (forgotten/drift single scan) — engine layer, not UI |
| **K-89D3** | Remaining feed build dedupe (partially covered by B2B) |

---

## H. Success Criteria (for K-89B2B implementation)

| Criterion | Measure |
|-----------|---------|
| One vault connection suggestion surface | Discover → Missing Connections only |
| Per-note neighbors | Links → Most Related only |
| Per-note analysis | Insights → gaps/tier/opportunities (no duplicate list) |
| Discover reachable in 1 click | Already met (B1) |
| No tab count change | Maintained |
| No collector/ranking change | Maintained |

---

## I. References

| Doc | Relevance |
|-----|-----------|
| `K-89B-knowledge-context-ia-audit.md` | IA options, overlap qualitative |
| `K-89B1-knowledge-context-simplification.md` | Post-B1 navigation validation |
| `K-89D-knowledge-rediscovery-audit.md` | Collector overlap %, engine inventory |
| `K-89D1-discovery-feed-performance.md` | Feed perf — do not regress |

### Key code paths

| Path | Role |
|------|------|
| `RelatedNotesPanel.tsx` | Most Related / Worth Revisiting |
| `DiscoveryPanel.tsx` | Vault feed UI |
| `CosmosInsightsPanel.tsx` | Suggested connections (dedupe target) |
| `CosmosActionsPanel.tsx` | Connection list (dedupe target) |
| `DiscoveryDashboardCard.tsx` | Sidebar entry |
| `NoteGraphView.tsx` | HUD duplicate feed build |
| `WorkspaceSearchPalette.tsx` | Optional duplicate `buildDiscoveryFeed` |
| `useNoteViewDashboard.ts` | Canonical `discoveryFeed` memo |

---

## Verification

This sprint is documentation-only:

```bash
ls frontend/docs/K-89B2-discovery-surface-consolidation.md
```

Implementation verification belongs to **K-89B2B** follow-up.
