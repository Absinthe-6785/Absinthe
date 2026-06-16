# K-91 — Knowledge Workflow Validation

**Branch:** `k91-knowledge-workflow-validation`  
**Status:** Validation complete — audit only, no feature changes  
**Scope:** End-to-end knowledge workflows, rediscovery, context IA, search boundaries, note lifecycle, large-vault UX  
**Prerequisites:** K-89 (search, IA, performance, discovery), K-90 (editor), K-90A/A1/A2/A3 (metadata surfaces)

**Constraint:** No architecture redesign, no new features, no performance optimization without evidence.

---

## Executive Summary

After K-89B1/B2/B2B and K-90A1/A2/A3, Absinthe’s **knowledge architecture is stable**. Remaining friction is **workflow discoverability and context depth**, not missing capability.

| Domain | Verdict |
|--------|---------|
| **Capture & edit** | Low friction — 1 click / Ctrl+N |
| **Tag & classify** | Low friction — Properties + header (post K-90A1) |
| **Structured relations** | Medium friction — Relations tab still in More (+2 tab switches) |
| **Rediscovery** | Medium friction — strong surfaces, overlapping entry points |
| **Search** | Medium friction — three surfaces with distinct roles but easy to confuse |
| **Large vault (3000+)** | UX acceptable when warm; cold load still painful |

**Highest-value follow-ups (evidence-backed):** promote Relations or fold Stats; consolidate review entry; clarify search labels; address cold index at 1000+ (K-89 C-1, UX blocker not perf tuning).

---

## A. Knowledge Workflow Report

### Methodology

Simulated workflows against **current code** (post K-90A3), using:

- `realisticUsageFixture.ts` category mix (EJU, TOEFL, Japanese, Workout, Reference)
- Click-path tracing through `NoteView`, `NoteContextPanelBody`, `useNoteViewPanelConfig`
- Prior audits cross-checked; stale claims updated (e.g. sidebar plain-text filter, Tags in Properties)

Assumptions: desktop, note open, context panel **open** unless noted. **+1** = panel collapsed → open.

---

### Scenario 1 — EJU economics note (active study)

**Persona:** Capture problem-set notes, tag by topic, link prerequisites, revisit before exam.

| Step | Path | Clicks / switches |
|------|------|-------------------|
| Capture | Sidebar **+** or Ctrl+N | **1** |
| Edit body | Default edit mode | **0** |
| Classify | Header `noteKind` selector → `literature` / `permanent` | **1** |
| Tag topic | Properties tab → `NoteTagsEditor` | **1 tab** + type/add |
| Wiki prerequisite | Type `[[EJU Math Drill]]` in body | **0 tabs** |
| Structured prereq | More → Relations → `prerequisite` + target | **2 tabs** + form |
| Rediscover stale drill | Discover tab → forgotten/drift card | **1 tab** + card |
| Per-note neighbors | Links → Most Related | **1 tab** |

**Friction:** Structured relations require More menu (2 tab switches). Wiki links are faster and preferred in practice.

---

### Scenario 2 — Japanese grammar note (concept + weak topic)

**Persona:** Grammar point capture, mark weak area, connect concepts, review queue.

| Step | Path | Clicks / switches |
|------|------|-------------------|
| Capture | Sidebar + | **1** |
| Mark weak | Header `WeakTopicToggle` | **1** (also adds `#weak-topic`) |
| Concept classify | Header → `concept` | **1** |
| Concept relations browse | Links → Structure → ConceptRelations (read-only) | **1 tab** |
| Edit concept relation | Links → “Edit in Relations tab” CTA | **+1 tab** (K-90A3) |
| Concept hub | Links → ConceptHub (when data exists) | **0 extra** |
| Weak-area review | Cosmos HUD → Review weak areas → Actions tab | **Ctrl+G** + HUD |

**Friction:** Concept relation **edit** routes to Relations tab (+1 intentional). Weak-topic review path goes through Cosmos HUD, not context primary tabs.

---

### Scenario 3 — TOEFL reading note (reading ↔ source workflow)

**Persona:** Reading note linked to source article, bibliography, reference relations.

| Step | Path | Clicks / switches |
|------|------|-------------------|
| Create reading note | Sidebar + | **1** |
| Link source | Links → Sources → `ReadingSourceLinkPanel` dropdown | **1 tab** + select |
| Classify | Header → `source` / `literature` | **1** |
| Bibliography | Links → Sources → `BibliographyPanel` | **0 extra** (same section) |
| Reference relation | More → Relations → `reference` preset | **2 tabs** |
| Find source again | Links → Sources navigate | **1 tab** |

**Friction:** Reading source workflow is **well-placed in Links** (K-90A3 kept). General relations still buried in More.

---

### Scenario 4 — Workout knowledge note (cross-domain)

**Persona:** Workout log with tags, related health notes, not heavy relations.

| Step | Path | Clicks / switches |
|------|------|-------------------|
| Capture | Sidebar + | **1** |
| Tag | Properties | **1 tab** |
| Related health note | Links → Related Notes → Link (wiki in body) | **1 tab** + Link |
| Vault browse by tag | Sidebar tag pill or Tags tab browse | **0–2** |
| Stats check | More → Stats (word count, links) | **2 tabs** |

**Friction:** Stats tab duplicates document metrics that could live in Properties footer (K-90A §F). Low severity for workout use case.

---

### Scenario 5 — Reference / archive note (lifecycle)

**Persona:** Source → literature → permanent promotion; long-term reference; archive browsing.

| Step | Path | Clicks / switches |
|------|------|-------------------|
| Classify source | Header `noteKind: source` | **1** |
| Promote | Header promote action (`promoteNoteKind`) | **1** |
| Smart collection | Workspace search palette → collection filter | **Ctrl+K** |
| Archive browse | Archive workspace shell (`ARCHIVE_SHELL_ENABLED`) | **Mode switch** |
| Trash | Sidebar trash folder | **1** |

**Friction:** Archive is a **separate shell** — intentional but adds mode switch. Lifecycle promotion is smooth via header.

---

### Workflow friction matrix (post K-90A)

| Workflow | Min path today | vs K-90A audit | Remaining friction |
|----------|----------------|----------------|-------------------|
| Capture | 1 click | Unchanged | Quick capture needs dashboard visible |
| Edit body | 0 (edit mode) | Unchanged | Reading mode +1 |
| Add tag | Properties tab | **Improved** (was More→Tags) | Tags tab browse-only by design |
| Add relation | More→Relations | Unchanged | **High** — 2 tab switches |
| Wiki link | Editor `[[...]]` | Unchanged | Low |
| Vault rediscover | Discover tab | **Improved** (was More) | Overlap with sidebar dashboard |
| Per-note rediscover | Links tab | Unchanged | Worth Revisiting may be collapsed |
| Review queue | Sidebar dashboard | Unchanged | Not in context primary strip |
| Find note (title) | Sidebar filter or Ctrl+K | **Improved** (sidebar wired) | Three search UIs still confusing |

---

## B. Rediscovery Assessment

### Surface inventory

| Surface | Location | Data | Actionable? | Competes with |
|---------|----------|------|-------------|---------------|
| **Discover tab** | Primary context | `buildDiscoveryFeed` — vault-wide | ✅ Revisit, create relation, hub | Sidebar dashboard |
| **Related Notes** | Links → Connections | KIS `getRelatedNotes` | ✅ Navigate, wiki Link | Discover (per-note vs vault) |
| **Worth Revisiting** | Links subsection | `groupRelatedNotes` heuristic | ✅ Navigate | Discover forgotten cards |
| **Backlinks / References** | Links | Body wiki + index | ✅ Navigate | — |
| **Concept Hub** | Links → Structure | Relations + wikis | ✅ Navigate | ConceptRelations list |
| **Cosmos graph** | Graph tab + full view | Neighborhood / global | ✅ Spatial browse | Discover spatial overlap |
| **Insights / Actions** | More | Intelligence snapshot | Link-out to Discover | Discover (K-89B2B deduped copy) |
| **Sidebar maintenance** | Dashboard | Shared `discoveryFeed` | ✅ Queue, orphans | Discover tab |

### Questions answered

**Can users naturally find old knowledge?**

- **Yes, if disciplined:** Discover tab (primary), Links Worth Revisiting, workspace search, sidebar tag/filter.
- **Risk for casual users:** Worth Revisiting **collapsed by default** when Most Related ≥ 3 (`RelatedNotesPanel` `defaultCollapsed`). Discover and sidebar dashboard both show feeds — users may not know which to open first.

**Are recommendations actionable?**

- **Discover:** Yes — revisit, create `related-to`, create hub (`DiscoveryPanel`).
- **Related Notes:** Yes — navigate, wiki Link, create related note.
- **Worth Revisiting:** Navigate only; recency uses `updatedAt` not content edit time (K-89 M-3) — may surface wrong notes.

**Are surfaces competing?**

| Overlap | Severity | Evidence |
|---------|----------|----------|
| Discover tab ↔ sidebar dashboard | **Medium** | Same `discoveryFeed` in HUD and dashboard |
| Insights/Actions ↔ Discover | **Low** (mitigated) | K-89B2B hints route to Discover |
| Related Notes ↔ Discover forgotten | **Low** | Different scope (per-note vs vault) |
| Cosmos HUD ↔ Discover | **Low** | HUD shortcuts call `handleOpenDiscover` |

### Rediscovery verdict

**Value: High** — multiple complementary paths. **Friction: Medium** — entry-point duplication and Worth Revisiting visibility.

---

## C. Search Workflow Assessment

### Three surfaces (distinct state)

| Surface | State var | Trigger | Filters / searches |
|---------|-----------|---------|-------------------|
| **Sidebar note filter** | `sidebarSearchQuery` | Sidebar input | Note list in folder context; plain `noteSearchScore` or knowledge syntax (`sidebarNoteListFilter.ts`) |
| **Workspace palette** | Modal + query | **Ctrl+K** | Cross-vault ranked search, projects, collections, paths (`WorkspaceSearchPalette.tsx`) |
| **Find in note** | `searchQuery` + scope | Toolbar, **Ctrl+F** | Active note body blocks (`editorSearch.ts`) |

### When to use each (intended)

| User intent | Correct surface |
|-------------|-----------------|
| Narrow sidebar list in current folder | Sidebar filter |
| Jump to any note/project in vault | Ctrl+K palette |
| Find text inside open note | Ctrl+F / toolbar find |

### Boundary clarity

| Issue | Status | Evidence |
|-------|--------|----------|
| Sidebar plain-text filters list | ✅ **Fixed** since K-89 | `NoteView.tsx` `filterNotesForSidebarList` |
| Sidebar vs palette labeling | ⚠️ **Partial** | Hint says “Ctrl+K opens workspace search” — sidebar role still implicit |
| Find-in-note vs knowledge query display | ⚠️ **Confusing** | `knowledgeQueryInfo` parses `searchQuery` (editor find), shown in sidebar header |
| `nvSearchNoResults` empty state | ✅ Wired | `NoteSidebarVirtualList` when `hasActiveSearch` |

### Search verdict

**Functionality: Good** at all measured scales (workspace search <15 ms at 3000 notes). **Mental model: Medium friction** — three inputs look similar; only palette is modal/obvious.

---

## D. Knowledge Context Validation

### Tab frequency (heuristic, code + prior audits)

| Tab | Expected frequency | Rationale |
|-----|-------------------|-----------|
| **Outline** | High | Default `rightPanel = 'toc'` |
| **Links** | High | Backlinks, related, sources — daily navigation |
| **Discover** | Medium–High | Primary since K-89B1 — vault rediscovery |
| **Properties** | Medium–High | Tags + custom fields (K-90A1) |
| **Cosmos (graph)** | Medium | Spatial exploration; lazy-loaded |
| **More → Relations** | Low–Medium | Power users, structured edges |
| **More → Tags** | Low | Browse-only; edit in Properties |
| **More → Stats** | Low | Read-only metrics |
| **More → Insights/Actions** | Low–Medium | When exploring intelligence |
| **More → Timeline** | Low | Periodic vault review |

### Duplication (post K-90A2/A3)

| Duplication | Status |
|-------------|--------|
| Tags CRUD in Tags tab | ✅ **Removed** — Properties canonical |
| Stats tag cloud | ✅ **Removed** |
| Concept relation CRUD in Links | ✅ **Removed** — browse + CTA |
| Discover vs Insights feed | ✅ **Mitigated** — K-89B2B |
| Stats vs Properties metrics | ⚠️ **Remains** — Stats tab still separate |
| Links vs Relations navigation | ✅ **Clarified** — hints + ownership |

### Context verdict

**11 tabs / 6-item More** still exceeds comfortable choice load (K-89B M-1). High-frequency paths improved (Discover, Properties tags). **Relations and Stats remain hidden in More.**

---

## E. Note Lifecycle Validation

| Stage | Mechanism | Transition friction |
|-------|-----------|---------------------|
| **New note** | `createNote()` — empty, edit mode | Low |
| **Active study** | Tags, weak topic, study project, areas | Low — header + Properties |
| **Reference** | `noteKind: source` → smart collections | Low |
| **Literature** | Promote via header | Low |
| **Permanent** | Promote via header | Low |
| **Archive** | Archive workspace shell | Medium — mode switch |
| **Trash** | `deletedAt` + trash folder | Low |

**Verdict:** Classification pipeline is clear. Archive is intentionally separate. No lifecycle blocker for study → reference → permanent.

---

## F. Large Vault Practical Validation (3000+ notes)

### UX focus (not raw ms)

| Workflow | Usefulness at 3000 | Friction |
|----------|-------------------|----------|
| Sidebar browse | Good — virtualized at 40+ | Folder + tag pills scale well |
| Sidebar search filter | Good — plain filter <5 ms | — |
| Ctrl+K jump | Good — ~13 ms | — |
| Open note → Links related | Good — O(1) precomputed | — |
| Open Discover tab | Acceptable — ~322 ms feed (current metrics) | Was ~1.5 s in K-89; improved |
| Cold app open / import | **Poor** — index ~496 ms–28 s depending on build | K-89 C-1: O(n²) related precompute |
| Cosmos full graph | Risky — force sim at 500+ nodes | Manual QA concern |

**Current metrics** (`k89-observed-metrics.json`, 2026-06-16): index 496 ms, discover 322 ms, search 10 ms at 3000 notes — **better than K-89 original report** but cold rebuild on import still blocks UX.

**Practical verdict:** Daily navigation and rediscovery are **usable** at 3000 when index is warm. **First load / restore** remains the dominant UX failure mode.

---

## G. Follow-Up Branches (evidence-prioritized)

| Priority | Branch | Scope | Evidence | Risk |
|----------|--------|-------|----------|------|
| **P1** | **K-91A Relations Discoverability** | Promote Relations to primary **or** Properties read-only summary + link | 2 tab switches for every structured edge; K-90A3 deferred K-90A3A | Low–Medium |
| **P1** | **K-91B Search Surface Clarity** | Label sidebar vs palette vs find-in-note; fix `knowledgeQueryInfo` source split | K-89A + K-91 §C confusion | Low |
| **P2** | **K-91C Review Workflow Promotion** | Review queue in context primary or Discover section | Queue only on sidebar dashboard | Low |
| **P2** | **K-91D Stats → Properties Fold** | Document metrics in Properties; demote Stats tab | K-90A §F; Stats rarely opened | Low |
| **P2** | **K-91E Worth Revisiting Visibility** | Default expanded or badge when collapsed | `defaultCollapsed` hides rediscovery | Low |
| **P3** | **K-89 C-1 Index Cold Build** | Incremental index / worker (perf with UX evidence) | 1000+ cold load blocks workflows | High |
| **P3** | **K-91F Header Tag Quick-Add** | Optional `+` on header chips → Properties | K-90A4 deferred | Low |

**Do not pursue without evidence:** Further tab removal, Discover redesign, Links redesign, Cosmos redesign.

---

## H. Success Criteria Check

| Criterion | Met? |
|-----------|------|
| Identify friction from real workflow simulation | ✅ Five scenarios traced |
| Rediscovery value assessed | ✅ §B |
| Search boundaries documented | ✅ §C (sidebar wired — K-89 doc stale) |
| Context tab value measured | ✅ §D |
| Large vault UX (not perf) | ✅ §F |
| Follow-ups evidence-backed only | ✅ §G |
| No architecture redesign | ✅ Audit only |

---

## I. Key Files

| Area | Path |
|------|------|
| Context IA | `KnowledgeContextPanel.tsx`, `useNoteViewPanelConfig.tsx` |
| Workflows | `NoteView.tsx`, `NoteContextPanelBody.tsx`, `NoteViewEditorArea.tsx` |
| Search | `sidebarNoteListFilter.ts`, `WorkspaceSearchPalette.tsx`, `editorSearch.ts` |
| Rediscovery | `groupRelatedNotes.ts`, `DiscoveryPanel.tsx`, `buildDiscoveryFeed` |
| Lifecycle | `noteClassification.ts`, `NoteClassificationSelector.tsx`, `smartCollections.ts` |
| Large vault | `realisticUsageFixture.ts`, `largeVaultBenchmark.ts`, `k89-observed-metrics.json` |
| Prior audits | `K-89-real-usage-validation.md`, `K-90A*.md`, `K-89B*.md` |
