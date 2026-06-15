# K-83 — Memory Audit (Render OOM Investigation)

**Branch:** `hotfix/k83-memory-audit`  
**Context:** Render reported *"Web Service fOr_Absinthe exceeded its memory limit"* before merging K-83.  
**Scope:** Audit only — no behavior fixes in this branch. Temporary `[MEM-AUDIT]` diagnostics added.

---

## Executive Summary

The OOM is **unlikely to be a classic subscription leak** (Supabase auth is cleaned up; no realtime channels). The dominant risks are:

1. **Per-keystroke vault-wide recomputation** while Notes is open (discovery feed, timeline, dashboard, index O(N) mention rescans).
2. **Duplicate note bodies** in `knowledgeIndexService.activeNotes` alongside Zustand `notes`.
3. **Cosmos universe mode** — perpetual `requestAnimationFrame` + `setTick` every frame → continuous React reconciliation while graph is open.
4. **Repeated uncached `buildNoteGalaxyMap`** (5+ calls per discovery feed, 2+ per timeline bucket).
5. **O(n²) force repulsion** per simulation frame in full-vault Cosmos graph.

---

## Temporary Diagnostics

Helper: `frontend/src/lib/memAudit.ts`

Logs shape:

```ts
console.info('[MEM-AUDIT]', {
  source,
  notes,
  links,
  graphNodes,
  graphEdges,
  relatedCandidates,
  discoveryItems,
  // optional extras per call site
});
```

| Source tag | File | Trigger |
|------------|------|---------|
| `buildGlobalGraphData` | `graph/buildGlobalGraphData.ts` | Every global graph build |
| `NoteGraphView.graphData` | `NoteGraphView.tsx` | Cosmos graph data change |
| `buildDiscoveryFeed` | `discovery/discoveryEngine.ts` | Every discovery feed build |
| `KnowledgeIndexService.buildFromNotes` | `KnowledgeIndexService.ts` | Bulk index rebuild |
| `KnowledgeIndexService.updateNote` | `KnowledgeIndexService.ts` | Index update (throttled 2s) |
| `NoteView.context` | `NoteView.tsx` | Notes/context panel data change |
| `useNoteViewDashboard` | `useNoteViewDashboard.ts` | Dashboard memos change |

**How to use on Render:** Open browser devtools or log drain; type in a note and watch `[MEM-AUDIT]` frequency. If `buildDiscoveryFeed` / `buildGlobalGraphData` fire on every keystroke, that confirms the hot path.

---

## 1. Cosmos

### Graph construction

| Builder | File | Cost | Rebuild trigger |
|---------|------|------|-----------------|
| `buildGlobalGraphData` | `graph/buildGlobalGraphData.ts` | O(N+E) | `NoteGraphView` `visibleKey` (any note `updatedAt` change) |
| `enrichGraphNodeMeta` | `graph/knowledgeUniverse/enrichGraphNodes.ts` | O(n²) galaxy orbit grouping + duplicate per-node passes | Graph init effect |
| `buildNoteGalaxyMap` | `graph/knowledgeUniverse/galaxyClustering.ts` | O(n × areas × links) | Called twice per Cosmos session (init + separate memo) |
| `buildExpandedGraphData` | `graph/buildExpandedGraphData.ts` | O(neighborhood) | `NoteView` — **any** `notes` array identity change |

### Node / edge caches

- **No module-level graph cache** — graphs rebuilt from `knowledgeIndexService` each time.
- **In-component refs:** `nodesRef`, `edgesRef` in `NoteGraphView` retain full graph for Cosmos session lifetime.
- **Index singleton** (`KnowledgeIndexService.ts:840`) — vault-scoped Maps; bounded by note count but **stores full bodies**.

### Force simulation lifecycle

- **No d3-force** — custom `requestAnimationFrame` loop in `NoteGraphView.tsx` (~303–394).
- **Cleanup:** `cancelAnimationFrame` on unmount/deps change — **OK**.
- **Universe mode:** rAF continues indefinitely when `simActive || (universeMode && !reducedMotion)`.
- **After forces settle:** `simActive === false` but universe mode still calls `setTick` **every frame** → full React re-render every frame.

### O(n²) hotspots

| Location | Pattern |
|----------|---------|
| `NoteGraphView` sim step | All-pairs repulsion O(n²) per frame while `simActive` |
| `enrichGraphNodes.ts` | `orbitNodes.filter` inside loop per galaxy |
| `getDisplayPos` render | `nodesRef.current.find` per node → O(n²) per SVG reconcile |
| `LocalGraphView` layout | `layout.find` per ring node (small n, capped) |

### Verdict

| Area | Status |
|------|--------|
| rAF cleanup on unmount | **Working** |
| Universe perpetual rAF + setTick | **Memory/CPU churn risk** |
| Graph rebuild on every note edit | **High risk** at scale |
| Duplicate galaxy map builds | **Medium risk** |

---

## 2. Knowledge Context

### Related notes / backlinks / referenced

- **Index-time:** `rebuildRelatedForNote` — scores all relationship neighbors per affected note (`KnowledgeIndexService.ts` ~788–835).
- **Read-time:** `groupRelatedNotes` — cheap slice from index; builds `noteById` Map over **all notes** each memo fire.
- **Backlinks:** `extractLinkContexts` — **O(N × body length)** full vault scan (`noteUtils.ts` ~624–677); keyed on `[notes, activeNote]`.

### Discovery feed

`buildDiscoveryFeed` (`discovery/discoveryEngine.ts`):

- Six signal collectors, each may call `buildNoteGalaxyMap` independently.
- `collectMissingConnectionSignals` — up to 28 × `buildSuggestedConnections` (O(N) each).
- `collectKnowledgeDriftSignals` — full O(N) vault scan.
- Runs on **every `notes` identity change** via `useNoteViewDashboard` memo.

### Timeline generation

`buildKnowledgeTimeline` → per-period `buildSnapshotMetrics`:

- `countLinksForNotes` → **`buildGlobalGraphData`** per bucket
- `countHubs` / `countGalaxies` → **`buildNoteGalaxyMap`** each
- `buildDiscoveryHistory` — O(N²) tag-pair loop (display capped at 500)

### Trigger: per-keystroke cascade

```
handleActiveBodyChange → noteUpdate → new notes[] reference
  → useNoteViewDashboard [notes] memos (discovery, timeline, dashboard, evolution…)
  → NoteView [notes] memos (backlinks, related, conceptHub, localGraph…)
  → knowledgeIndexService.updateNote → O(N) mention rescan
```

Cloud body sync is debounced; **local recompute is not**.

### Verdict

| Area | Status |
|------|--------|
| `relatedByNoteId` growth | Bounded by vault; hub notes can be large |
| Body duplication in index | **High memory risk** |
| Per-keystroke feed/timeline rebuild | **Critical CPU/GC risk** |
| `[notes]` over-broad useMemo deps | **Critical** — index-only memos still depend on `notes` |

---

## 3. React Lifecycle

### Observers — generally OK

- `ResizeObserver` in `NoteGraphView`, `LocalGraphView`, `observeScrollRect`, `useTocScrollSpy` — all disconnect on cleanup.

### Probable leak patterns

| Priority | File | Issue |
|----------|------|-------|
| **High** | `KnowledgeContextPanel.tsx` | Panel resize drag — window `pointermove`/`pointerup` only removed on pointer-up, not unmount |
| **High** | `editorDragDrop.tsx` | Active block drag — listeners retained if editor unmounts mid-drag |
| **Medium** | `useMermaid.ts` | CDN `<script>` appended to `document.head` without removal |
| **Medium** | `NoteView.tsx` ~1073 | TOC scroll `setTimeout(800)` without cancel |
| **Medium** | `useNoteViewPanels.ts` | Wiki-link `setTimeout` without cancel on unmount |
| **Low** | `NoteRelationsPanel.tsx` | Blur timeout → possible setState after unmount |

### Intentional session retainers (not bugs)

- `useNotesStore` module-level `pagehide`/`beforeunload`/`storage` listeners
- `knowledgeIndexService` singleton
- `useBlockEditor` history cap (200 markdown strings)

---

## 4. Supabase

| Check | Result |
|-------|--------|
| `onAuthStateChange` | `App.tsx` — unsubscribed in effect cleanup **OK** |
| Realtime `.channel()` | **None found** |
| Persistent subscriptions | **None beyond auth** |

**Verdict:** Supabase is not a probable OOM source today.

---

## 5. Memoization

### Broken or over-broad deps

| Memo | File | Issue |
|------|------|-------|
| `discoveryFeed`, `knowledgeTimeline`, `unifiedWorkspaceDashboard` | `useNoteViewDashboard.ts` | `[notes]` — rebuild per keystroke |
| `localGraphData` | `NoteView.tsx` | `[notes]` but builder uses `service` only |
| `allTags`, `resolvedOutgoingRelations`, `incomingRelationDisplays` | `NoteView.tsx` | `[notes]` unnecessary — index is source |
| `mentioningNotes` | `NoteView.tsx` | `[activeNote, notes]` — `notes` forces rebuild on every edit |
| `noteIntelligenceSnapshot` + `noteTierInput` | `useNoteViewPanels.ts` | Duplicate `buildNoteGalaxyMap` per switch |
| `visibleNodes` / `navigableNodeIds` | `NoteGraphView.tsx` | New array every render → downstream memos ineffective |

### Repeated graph rebuilding

- `buildNoteGalaxyMap` — no shared cache; called from discovery (5+), timeline (2× per bucket), intelligence snapshot, Cosmos init.
- `buildGlobalGraphData` — per timeline bucket + Cosmos + panel triggers.

---

## Probable Leak Sources (Ranked)

| # | Source | Type | Severity |
|---|--------|------|----------|
| 1 | Per-keystroke discovery + timeline + dashboard rebuild | Allocation churn | **Critical** |
| 2 | `activeNotes` full body duplication | Memory retention | **High** |
| 3 | Cosmos universe mode every-frame `setTick` | CPU/GC churn | **High** (while graph open) |
| 4 | O(n²) force repulsion per sim frame | CPU spike | **High** (large vault + Cosmos) |
| 5 | Uncached `buildNoteGalaxyMap` multiplication | CPU | **High** |
| 6 | `extractLinkContexts` on every `notes` change | CPU | **Medium** |
| 7 | Panel resize / drag listeners on unmount | Listener leak | **Medium** |
| 8 | Timeline `buildGlobalGraphData` per bucket | CPU | **Medium** |
| 9 | `historyEvents` (5000) retained in Cosmos | Memory | **Low–Medium** |

---

## Memory Growth Risks

| Risk | Mechanism | When |
|------|-----------|------|
| Heap grows with vault size | Index + store both hold bodies | Always |
| GC pressure while typing | Vault builders + index O(N) scan | Every body keystroke |
| Spike on Cosmos open | Full graph + enrich + sim + vaultAnalysis + discoveryFeed | `viewMode === 'graph'` |
| Spike on timeline tab | `buildKnowledgeTimeline` with per-bucket graph | Panel tab switch + any `notes` change |
| Listener retention | Mid-gesture unmount during resize/drag | Rare but real |

---

## O(n²) or Worse — Summary

| Computation | Location | When |
|-------------|----------|------|
| All-pairs repulsion | `NoteGraphView` sim | Per frame while sim active |
| Galaxy orbit filter loop | `enrichGraphNodes.ts` | Graph init |
| `buildDiscoveryHistory` tag pairs | `timelineMetrics.ts` | Timeline build |
| `buildSuggestedConnections` × 28 | `discoverySignals.ts` | Discovery feed |
| `getDisplayPos` find per node | `NoteGraphView` render | Every universe frame |
| `indexMentionsFromSource` scan | `KnowledgeIndexService` | Per body update |

---

## Recommended Fixes (Post-Audit — Do Not Merge Yet)

### P0 — Stop per-keystroke vault scans

1. Debounce or structural-share `notes` updates for body edits; or split store so context panel subscribes to index version / active note only.
2. Replace `[notes]` deps with `activeNote?.id`, index generation counter, or stable selectors where index is source of truth.

### P0 — Share expensive builds

3. Single `buildNoteGalaxyMap` per `buildDiscoveryFeed` / `buildKnowledgeTimeline` / intelligence snapshot (K-43 deferred).
4. Cache or incremental `buildGlobalGraphData` for timeline buckets.

### P1 — Cosmos

5. Stop `setTick` every frame in universe mode after layout settles; use CSS transform or throttle to 1–2 fps for orbit animation.
6. Memoize `visibleNodes` / render-path filters in `NoteGraphView`.
7. Don't restart full sim on every `updatedAt` change — diff graph topology only.

### P1 — Index memory

8. Store body hash or link-extraction snapshot in `activeNotes` instead of full body duplicate; or reference store body read-only.

### P2 — Lifecycle

9. Add unmount cleanup to `KnowledgeContextPanel` resize drag and `editorDragDrop` active sessions.
10. Cancel TOC/wiki-link timeouts on unmount.

### P2 — Normalize ops alignment

11. Apply `minimalDragIds` pattern already used for drag to duplicate/copy/delete (K-83 product fix — separate from OOM).

---

## Verification Plan

1. Deploy `hotfix/k83-memory-audit` to staging with log drain enabled.
2. Reproduce: open Notes → type continuously for 60s → open Cosmos universe → switch timeline tab.
3. Count `[MEM-AUDIT]` lines per action; note which `source` tags fire per keystroke.
4. Compare heap snapshot before/after with Chrome Performance/Memory tools locally at 200/500/1000 notes.
5. Remove `[MEM-AUDIT]` diagnostics after root cause confirmed.

---

## Related Docs

- `frontend/docs/K-43-performance-audit.md` — prior galaxy-map / discovery feed analysis
- `frontend/docs/K-83-product-finalization-audit.md` — K-83 UX audit (separate from OOM)
- `frontend/docs/editor-performance-report.md` — large document benchmarks

---

## Files Touched (Audit Branch Only)

- `frontend/src/lib/memAudit.ts` — diagnostic helper (temporary)
- `frontend/src/components/views/features/knowledge/graph/buildGlobalGraphData.ts`
- `frontend/src/components/views/features/knowledge/discovery/discoveryEngine.ts`
- `frontend/src/components/views/features/knowledge/KnowledgeIndexService.ts`
- `frontend/src/components/views/NoteGraphView.tsx`
- `frontend/src/components/views/NoteView.tsx`
- `frontend/src/components/views/noteview/useNoteViewDashboard.ts`
- `frontend/docs/K-83-memory-audit.md`
