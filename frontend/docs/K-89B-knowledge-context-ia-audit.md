# K-89B — Knowledge Context IA Audit & Simplification

**Branch:** `k89b-knowledge-context-ia`  
**Status:** Audit complete — no IA changes implemented  
**Scope:** Knowledge Context tab structure, discovery surface overlap, navigation friction  
**Constraint:** No redesign, no new discovery systems, no tab-count increase in this sprint

**Prerequisites completed:** K-89 validation, K-89A (search/interaction), K-89C (index perf), K-89D/D1 (rediscovery + feed perf)

---

## Executive Summary

Knowledge Context has **11 tabs** (5 primary + 6 in More). Performance is no longer the primary friction — **information architecture is**.

The panel works well for **note-centric linking** (Links tab: Related Notes, backlinks) and **in-document navigation** (Outline). Rediscovery and metadata workflows pay the highest **navigation tax**: Discover, Relations, Timeline, and Stats live in a 6-item More menu; discovery signals appear in **five parallel surfaces** with partial overlap.

**Simplest structure that preserves discovery power** (audit conclusion):

```text
Primary: Outline | Links | Cosmos | Discover | Properties
More:    Insights | Actions | Timeline | Relations | Stats
(Tags tab removed — edit tags in Properties only)
```

This is a **swap + demotion** (10 visible tabs, not 11): promote **Discover** to primary, demote **Insights** to More, remove standalone **Tags**. Tab count stays at five primary; total surfaces drop by one.

---

## A. Knowledge Context Audit

### A.1 Current structure (code)

| Layer | File |
|-------|------|
| Shell (tab strip, More menu, resize) | `KnowledgeContextPanel.tsx` |
| Content router | `NoteContextPanelBody.tsx` |
| Tab definitions | `useNoteViewPanelConfig.tsx` |
| Lazy-load gates | `contextPanelTabGate.ts` |
| Open panel API | `useNoteViewPanels.ts` → `openContextPanel(tab)` |

**Primary tabs** (`PRIMARY_TAB_KEYS`):

```text
Outline (toc) | Links | Cosmos (graph) | Insights | Properties
```

**More menu** (6 items):

```text
Actions | Discover | Timeline | Tags | Relations | Stats
```

Default tab: `toc`. Panel visible when `showRightPanel && viewMode !== 'graph' && (activeNote || discover || timeline)`.

No keyboard shortcuts target individual context tabs (panel toggle is click-only; `Ctrl+G` opens full Cosmos view mode, not context graph tab).

### A.2 Usage path audit

Measured as **minimum clicks + tab changes** from an open note in edit mode with context panel already visible. Opening the panel from collapsed adds **+1** (header `AlignLeft` toggle).

| Workflow | Path | Clicks / tab changes | Friction |
|----------|------|----------------------|----------|
| **Read note → jump to section** | Outline tab (default) → click heading | 1 | **Low** |
| **Read note → follow wiki connection** | Links → Related / Backlinks → click note | 2 | **Low** |
| **Read note → find related knowledge** | Links → Most Related (top of Connections) | 2 | **Low** |
| **Read note → revisit stale neighbor** | Links → Worth Revisiting (collapsed if Most Related non-empty) | 2–3 | **Medium** — section may be collapsed |
| **Read note → vault-wide forgotten hubs** | More → Discover → scroll section | **3–4** | **High** — Discover buried |
| **Read note → structured relation** | More → Relations → add/edit edge | **3–4** | **High** — Relations buried |
| **Read note → review metadata** | Properties tab | 1 | **Low** |
| **Read note → edit tags only** | More → Tags **or** Properties | 2–3 | **Medium** — duplicate path |
| **Read note → suggested connection (per-note)** | Insights → Suggested Connections | 2 | **Medium** |
| **Read note → suggested connection (vault)** | More → Discover → Missing Connections | **3–4** | **High** — same engine, different entry |
| **Read note → local graph** | Cosmos tab | 1 | **Low** |
| **Read note → evolution history** | More → Timeline | **2–3** | **Medium** |
| **No note → browse discovery** | More → Discover (panel opens without note) | 2 | **Medium** |
| **Sidebar dashboard → discovery** | Dashboard card → Discover tab | 2 | **Medium** — dual entry (M-2) |
| **Full Cosmos HUD → discovery** | Graph view → HUD button → Discover tab | 3+ | **High** — context switch from graph mode |

**Context switching hotspots:**

1. **More menu** — every buried tab costs an extra click + menu scan (6 choices).
2. **Dashboard ↔ Context** — same Discover tab, two entry narratives (sidebar vs panel).
3. **Insights vs Discover** — both surface connection suggestions; user must guess which tab.
4. **Edit mode ↔ Graph mode** — full Cosmos (`viewMode === 'graph'`) hides context panel entirely.

### A.3 Surface inventory

| Surface | Tab key | Purpose | Est. frequency | Overlap | Unique value |
|---------|---------|---------|----------------|---------|--------------|
| **Outline** | `toc` | Heading navigation in active note | **High** | None | In-document structure |
| **Links** | `links` | Per-note connections, structure, sources | **High** | Partial with Relations, Insights | **Canonical per-note linking** |
| **Cosmos** | `graph` | Local neighborhood graph | **Medium** | Spatial view of Links data | Visual proximity, expand/collapse |
| **Insights** | `insights` | Per-note intelligence, tier, suggested connections | **Medium** | **High** with Discover + Actions | Single-note opportunities/gaps |
| **Properties** | `properties` | Metadata, classification, tags inline | **Medium–High** | **High** with Tags, partial Stats | **Canonical metadata editor** |
| **Actions** | `actions` | Cosmos action plan (connect, hub, area) | **Low** | **High** with Insights + Discover | Executable plan from snapshot |
| **Discover** | `discover` | Vault-wide discovery feed | **Low visible / High value** | **High** with Insights, dashboard, HUD | **Canonical vault rediscovery** |
| **Timeline** | `timeline` | Evolution, activity, journey, exports | **Low** | Partial with Discover history | Temporal lens |
| **Tags** | `tags` | Tag editor + vault tag cloud | **Low–Medium** | **Full** subset of Properties | Tag cloud browse (only unique bit) |
| **Relations** | `relations` | Typed outgoing/incoming edges | **Medium** (power users) | Partial with Links wiki edges | **Structured relations (K-13+)** |
| **Stats** | `stats` | Word/char/link counts + tag cloud | **Low** | Partial with Properties, Tags | Read-only analytics |

**Nested surfaces inside Links** (not separate tabs):

| Section | Components | Frequency | Overlap |
|---------|------------|-----------|---------|
| Connections | `RelatedNotesPanel`, `BacklinkPanel`, `ReferenceExplorerPanel` | **High** | Worth Revisiting vs Discover forgotten |
| Structure | `ConceptHubPanel`, `ConceptRelationsPanel`, `LearningPathPanel` | Medium | Concept relations vs Relations tab |
| Sources | `ReadingSourceLinkPanel`, `BibliographyPanel` | Low (reading notes) | None |

### A.4 Overlap analysis

| Pair | Overlap type | Severity | Notes |
|------|--------------|----------|-------|
| **Insights ↔ Discover** | Suggested connections | **High** | Same `buildSuggestedConnections` engine (K-89D) |
| **Insights ↔ Actions** | Connection recommendations | **High** | `buildCosmosActionPlan` vs snapshot suggestions |
| **Links Worth Revisiting ↔ Discover Forgotten** | Inactivity / revisitation | **Medium** | Per-note vs vault-wide; different signals (K-89D) |
| **Tags ↔ Properties** | Tag editing | **Full** | Tags tab redundant for edit path |
| **Stats ↔ Properties** | Metadata-adjacent | **Low** | Stats is read-only counts |
| **Links ↔ Relations** | Edge display | **Medium** | Wiki `[[links]]` vs typed `relations[]` |
| **Discover ↔ Dashboard review** | Stale / least-revisited lists | **Medium** | Dual entry, similar intent (K-89 M-2) |
| **Cosmos HUD ↔ Discover tab** | Vault discovery | **Medium** | HUD buttons call `handleOpenDiscover` |

**Non-overlapping cores (preserve):**

- **Links → Most Related** — O(1) index lookup; best per-note navigation (K-89D: Core).
- **Discover → Missing Connections + Forgotten** — vault-wide, actionable (K-89D: Core).
- **Outline** — unique in-document affordance.
- **Relations** — unique typed-edge model (not replaceable by wiki links alone).

### A.5 Navigation friction summary

| Friction | ID | Evidence |
|----------|-----|----------|
| Discover buried in More | H-4 | `KnowledgeContextPanel.tsx` — 6 More items |
| 11 tabs exceed comfortable choice load | M-1 | K-89 §5, K-87 §2.3 |
| Dual discovery entry (sidebar + panel) | M-2 | `DiscoveryDashboardCard`, `handleOpenDiscover` |
| Worth Revisiting hidden when Most Related populated | — | `RelatedNotesPanel` `defaultCollapsed` |
| No tab keyboard shortcuts | — | `NoteViewShortcutsModal` — no panel tab bindings |
| Tags / Properties duplication | — | K-87 §2.2 |

**Post-K-89A note:** Sidebar plain-text filter is now wired (`sidebarSearchQuery`); vault-wide search friction is reduced outside the context panel. Context IA remains the main remaining UX debt.

**Post-K-89D1 note:** Discover tab compute is ~300 ms at 3000 notes — **opening Discover is no longer a performance deterrent**.

---

## B. Discovery Audit

### B.1 Discovery sources map

| Source | Location | Scope | Engine | Rediscovery value |
|--------|----------|-------|--------|-------------------|
| **Most Related** | Links → Connections | Per note | `groupRelatedNotes` | **Core** — instant contextual jump |
| **Worth Revisiting** | Links → Connections | Per note | Same pool + inlink/recency heuristic | **Core** — distinct from vault scan |
| **Backlinks** | Links → Connections | Per note | Index edges | **Core** — inbound discovery |
| **Suggested Connections** | Insights | Per note | `buildNoteIntelligenceSnapshot` | **Useful** — overlaps vault feed |
| **Connection recommendations** | Actions | Per note | `buildCosmosActionPlan` | **Low** — power-user overlap |
| **Discover feed** | Discover tab | Vault | `buildDiscoveryFeed` | **Core** — canonical vault rediscovery |
| **Knowledge Review lists** | Sidebar dashboard | Vault | `buildKnowledgeReviewLists` | **Redundant partial** — dashboard only |
| **Cosmos intelligence HUD** | Full graph | Vault / focus | Snapshot + HUD | **Redundant partial** |
| **Timeline discovery progress** | Timeline | Historical | `buildDiscoveryProgressSummary` | **Useful** — temporal, not navigational |

### B.2 Which surfaces actually help rediscovery?

| Tier | Surfaces | Verdict |
|------|----------|---------|
| **Primary (keep prominent)** | Links (Most Related + Backlinks), **Discover tab** | Highest daily reuse for finding forgotten/related knowledge |
| **Secondary (keep accessible)** | Worth Revisiting, Insights (gaps/opportunities), Relations | Valuable but narrower audience |
| **Tertiary (demote)** | Actions, Stats, Tags tab | Power-user or redundant |
| **Entry-point consolidation target** | Dashboard cards, Cosmos HUD | Should route to canonical tabs, not duplicate UI |

### B.3 Duplication verdict

- **Do not merge** Links and Discover — scopes differ (per-note vs vault). K-89D confirms separate pipelines.
- **Do merge entry points** — one narrative: “related here” = Links; “vault opportunities” = Discover.
- **Do dedupe presentation** — Insights suggested connections and Actions recommendations should not compete with Discover for the same user question (“what should I connect?”). Prefer **one vault answer** (Discover) and **one local answer** (Links / Insights gaps).

### B.4 Primary discovery recommendation

| Question | Canonical surface |
|----------|-------------------|
| “What relates to **this note**?” | **Links** tab |
| “What am I **forgetting** vault-wide?” | **Discover** tab (promote to primary) |
| “What **structured edges** exist?” | **Relations** (promote or group under Metadata) |
| “How did my vault **evolve**?” | **Timeline** (keep secondary) |

---

## C. More Menu Audit

### C.1 Current More contents

```text
Actions | Discover | Timeline | Tags | Relations | Stats
```

| Item | Belongs in More? | Promotion candidate? | Rationale |
|------|------------------|----------------------|-----------|
| **Discover** | **No** | **Yes — primary** | Core rediscovery; K-89 H-4; perf fixed in K-89D1 |
| **Relations** | **No** | **Yes — primary or Metadata group** | K-87 Option A; linking workflow friction |
| **Timeline** | Yes | No | Archive/history lens; low daily frequency |
| **Actions** | Yes | No | Power-user; overlaps Insights |
| **Tags** | **No** | **Demote entirely** | Subset of Properties |
| **Stats** | Yes | Optional Metadata group | Low frequency; metadata-adjacent |

### C.2 Target More menu (≤3 items — aspirational)

After Tags demotion and Discover promotion:

```text
More: Insights | Actions | Timeline | Relations | Stats   (5 items today)
```

To reach ≤3 without adding tabs, **group metadata**:

```text
More: Insights | Actions | Timeline
(Relations + Stats folded into Properties or Metadata sub-nav)
```

**Relations** and **Stats** are the tension: both merit access but not daily tab-bar space. K-87 Option B (Metadata dropdown) resolves this without increasing primary tab count.

---

## D. Context Hierarchy Proposals

*All options preserve capability; none add net tabs. Implement in follow-up branches only.*

### Option A — Promote Relations (K-87 minimal change)

```text
Primary: Outline | Links | Cosmos | Insights | Properties | Relations
More:    Actions | Discover | Timeline | Tags | Stats
```

| Pros | Cons |
|------|------|
| Surfaces structured linking without submenu | **7 primary tabs** — crowded on tablet (K-81 compact chrome) |
| Small code diff (`PRIMARY_TAB_KEYS` only) | Discover still buried — **does not fix H-4** |
| Aligns with linking-heavy workflows | Tags redundancy unchanged |

**Best for:** Users who add typed relations frequently; minimal engineering risk.

---

### Option B — Promote Discover (K-89 rediscovery-first)

```text
Primary: Outline | Links | Cosmos | Discover | Properties
More:    Insights | Actions | Timeline | Tags | Relations | Stats
```

| Pros | Cons |
|------|------|
| Fixes H-4 directly; vault rediscovery visible | Insights demoted — per-note intelligence less obvious |
| No tab count increase (swap) | Relations still buried |
| Aligns with K-89 “knowledge reuse” goal | Users may conflate Discover with Links |

**Best for:** Large vaults, casual rediscovery, post-K-89D1 perf (Discover opens fast).

---

### Option C — Discovery-first Context

```text
Primary: Outline | Links | Discover | Properties | Cosmos
More:    Insights | Actions | Timeline | Relations | Stats
```

| Pros | Cons |
|------|------|
| Links + Discover adjacent — “local vs vault” clear | Cosmos demoted — spatial users pay +1 click |
| Four conceptual pillars: navigate, connect, rediscover, describe | Larger IA shift than Option B |
| Tags still demotable separately | Graph-as-secondary may surprise existing users |

**Best for:** Knowledge-first product positioning; vaults 500+ notes.

---

### Option D — Consolidated Discovery Surface

Keep tab count; **consolidate content** rather than tabs:

1. **Links Connections** — add compact “Vault picks” strip (top 2 Discover items) linking to full Discover tab.
2. **Insights** — remove suggested-connections block (defer to Discover); keep gaps/opportunities only.
3. **Actions** — remove connection list (defer to Discover).
4. **Dashboard** — single “Open Discover” card; remove parallel review lists or cross-link.

| Pros | Cons |
|------|------|
| No primary-tab shuffle — lowest visual churn | Cross-panel UI work; not just `PRIMARY_TAB_KEYS` |
| Reduces **perceived** overlap without removing collectors | Strip in Links may feel crowded |
| Preserves all 11 tab keys initially | Does not reduce decision count in tab bar |

**Best for:** Incremental UX polish before tab promotion (K-89B3).

---

### Option E — Metadata group (K-87 Option B — structural)

```text
Primary: Outline | Links | Cosmos | Insights | Metadata ▾
         ├ Properties
         ├ Relations
         └ Stats
More:    Discover | Actions | Timeline
(Tags removed — Properties only)
```

| Pros | Cons |
|------|------|
| Clearest hierarchy; fewer top-level choices | Requires dropdown/accordion UX — **medium engineering** |
| Relations + Stats logically grouped | Discover still in More unless combined with Option B |
| Tags demotion natural | Two navigation patterns (tabs + dropdown) |

**Best for:** Long-term IA clarity; pair with Option B (Discover primary + Metadata dropdown).

---

## E. Cognitive Load Review

| Dimension | Current | Target |
|-----------|---------|--------|
| **Tab count** | 11 | ≤10 (Tags demotion); primary stays 5 |
| **More menu choices** | 6 | ≤3–4 |
| **Decision cost** | High — “where is discovery?” | One vault answer (Discover), one local answer (Links) |
| **Visual complexity** | 5 icons + More chevron + 6 hidden tabs | Same chrome; better primary allocation |
| **Information redundancy** | 3× connection suggestions | 1× local (Links/Insights gaps) + 1× vault (Discover) |
| **Capability loss** | — | **None** if demotions are merges, not removals |

**Miller heuristic:** Primary strip at **5±1** is acceptable; **5 primary + 6 More** fails because More becomes a second tab bar.

---

## F. IA Recommendation

### Preferred structure (audit)

**Phase 1 — K-89B1 (low risk):** Option B + Tags demotion

```text
Primary: Outline | Links | Cosmos | Discover | Properties
More:    Insights | Actions | Timeline | Relations | Stats
Tags:    removed as standalone tab (Properties + tag cloud in Stats if needed)
```

**Phase 2 — K-89B2 (medium risk):** Option D content dedupe

- Strip Insights/Actions connection duplicates.
- Dashboard → single Discover entry.
- Optional Links “vault picks” strip.

**Phase 3 — K-89B3 (optional):** Option E Metadata dropdown + Relations/Stats fold

### Alternative structures

| Alternative | When to choose |
|-------------|----------------|
| **Option A only** | Relation-heavy workflows; avoid Discover promotion |
| **Option C** | Willing to demote Cosmos for stronger discovery IA |
| **Option D only** | Minimize tab-bar churn; polish overlap first |
| **Option E** | Ready for dropdown UX; best long-term metadata model |

### Tradeoff summary

| Criterion | Option A | Option B ★ | Option C | Option D | Option E |
|-----------|----------|-----------|----------|----------|----------|
| Fixes Discover buried | ❌ | ✅ | ✅ | Partial | Partial |
| Fixes Relations buried | ✅ | ❌ | ❌ | ❌ | ✅ |
| Tab count change | +1 primary | Swap | Swap | None | Restructure |
| Engineering risk | Low | Low | Low | Medium | Medium–High |
| Reduces overlap | ❌ | Partial | Partial | ✅ | Partial |
| Tablet fit | Poor (6 primary) | Good | Good | Good | Good |

★ **Preferred first step** — best balance of K-89 findings, low diff, no tab increase.

---

## G. Migration Assessment

### Low risk

| Change | Files | Risk |
|--------|-------|------|
| Promote Discover ↔ demote Insights in `PRIMARY_TAB_KEYS` | `KnowledgeContextPanel.tsx` | **Low** — reorder only; lazy gates unchanged |
| Remove Tags tab from config | `useNoteViewPanelConfig.tsx`, `NoteContextPanelBody.tsx` | **Low** — Properties already edits tags |
| Update default `handleOpenDiscover` to land on visible tab | `useNoteViewPanels.ts` | **Low** |
| i18n / docs / empty-state copy | `i18n.ts`, panel hints | **Low** |
| Persist last tab per user | `useNoteViewState.ts` | **Low** — optional polish |

### Medium risk

| Change | Risk |
|--------|------|
| Metadata dropdown (Option E) | New shell UX; keyboard/a11y for submenu |
| Links “vault picks” strip (Option D) | Feed subscription when Links tab open; layout |
| Remove Insights suggested-connections block | User expectation shift; verify Actions still sufficient |
| Dashboard dedupe (single Discover entry) | Sidebar layout change |
| Promote Relations to primary (Option A) | 6 primary tabs on tablet |

### High risk

| Change | Risk |
|--------|------|
| Merge Discover + Links into one tab | Conflates scopes; hurts per-note fast path (K-89D) |
| Remove Actions / Timeline / Stats tabs entirely | Capability loss without replacement |
| Full Cosmos redesign | Out of scope |
| New discovery collectors or AI surfaces | Constraint violation |
| Increase primary tab count beyond 6 | Compact chrome breakage (K-81 tablet audit) |

---

## H. Proposed Follow-Up Branches

### K-89B1 — Knowledge Context Simplification

**Scope:** Option B + Tags demotion

- `PRIMARY_TAB_KEYS`: swap `insights` → `discover`
- Remove `tags` tab; redirect tag editing to Properties
- Reduce More to 5 items; update K-81 docs
- Regression: tab gate tests, `openContextPanel('discover')` entry points

**Addresses:** H-4, M-1 (partial), Tags redundancy

---

### K-89B2 — Discovery Surface Consolidation

**Scope:** Option D content dedupe (no tab bar change)

- Insights: hide suggested connections when Discover primary
- Actions: defer connection list to Discover
- Dashboard: unify discovery entry; cross-link review lists
- Optional: Links “vault picks” micro-strip (2 items max)

**Addresses:** M-2, Insights/Discover/Actions overlap (K-89D)

---

### K-89B3 — Context Navigation Polish

**Scope:** Option E metadata group + navigation affordances

- Metadata dropdown (Properties / Relations / Stats)
- Optional Relations promotion inside Metadata
- Last-tab persistence; Worth Revisiting default expand policy
- Panel keyboard shortcut (`Ctrl+.` or similar) — evaluate separately

**Addresses:** M-1, Relations burial, power-user metadata paths

---

## I. Constraints Checklist

| Constraint | Status |
|------------|--------|
| No Cosmos redesign | ✅ Audit only |
| No Related Notes redesign | ✅ Preserved as canonical per-note surface |
| No new discovery systems | ✅ Reallocation only |
| No tab count increase | ✅ Proposals swap or demote |
| Audit before implement | ✅ This document |

---

## J. References

| Doc | Relevance |
|-----|-----------|
| `K-89-real-usage-validation.md` | Workflow friction, H-4, M-1, context §5 |
| `K-89D-knowledge-rediscovery-audit.md` | Surface overlap matrix, collector vs Links |
| `K-89D1-discovery-feed-performance.md` | Discover tab no longer perf-blocked |
| `K-89A-search-integrity-report.md` | Sidebar filter fixed; search ≠ context |
| `K-87-search-ia-audit.md` | Options A/B metadata, frequency heuristics |
| `K-81-notes-workflow-refinement.md` | Primary/More split, Links ordering |

### Key code paths

| Path | Role |
|------|------|
| `KnowledgeContextPanel.tsx` | `PRIMARY_TAB_KEYS`, More menu |
| `NoteContextPanelBody.tsx` | Tab content routing |
| `LinksContextPanel.tsx` | Connections-first layout |
| `RelatedNotesPanel.tsx` | Most Related / Worth Revisiting |
| `DiscoveryPanel.tsx` | Vault feed sections |
| `CosmosInsightsPanel.tsx` | Per-note suggestions |
| `useNoteViewPanels.ts` | `openContextPanel`, `handleOpenDiscover` |

---

## Verification

This sprint is documentation-only:

```bash
# No code changes required for audit sign-off
ls frontend/docs/K-89B-knowledge-context-ia-audit.md
```

Implementation verification belongs to K-89B1+ follow-ups.
