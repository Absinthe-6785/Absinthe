# K-83A — Memory Stabilization (P0/P1)

Addresses highest-confidence memory and recomputation risks from [K-83-memory-audit.md](./K-83-memory-audit.md) before merging K-83.

---

## Before / After Architecture

### Before

```
Body keystroke
  → updateNote() replaces notes[]
  → syncKnowledgeIndexForNote() immediately (O(N) mention scan)
  → NoteView re-render
  → useMemo([notes]) invalidates ALL vault builders:
        discovery feed, timeline, dashboard, backlinks, concept hub, …
  → buildNoteGalaxyMap() × 5+ per discovery feed
  → activeNotes stores full body duplicate per note
  → Cosmos universe mode: rAF + setTick every frame forever
```

### After

```
Body-only keystroke
  → updateNote() updates notes[] (editor still live)
  → vaultStructureVersion unchanged
  → index update debounced (600ms, same as cloud sync)
  → indexContentVersion bumps only after debounced index flush
  → Dashboard/discovery/timeline memos keyed on vaultStructureVersion
  → Backlinks/related memos keyed on indexContentVersion + activeNote
  → KnowledgeIndexService reads bodies via bodyProvider → Zustand
  → getNoteGalaxyMap() shared cache per vaultStructureVersion
  → Cosmos rAF stops when force simulation settles (simActive === false)
```

### Version counters (`useNotesStore`)

| Counter | Bumps when | Drives |
|---------|------------|--------|
| `vaultStructureVersion` | title, properties, relations, folder, create, delete, trash, restore, note switch (lastOpenedAt) | Discovery, timeline, dashboard, galaxy cache, maintenance |
| `indexContentVersion` | debounced body index flush, flushPendingSync | Backlinks, related notes, page references, local graph |

---

## P0 — Per-Keystroke Vault Rebuild

### Changes

| Area | File | Fix |
|------|------|-----|
| Body vs structure split | `useNotesStore.ts` | `isBodyOnlyPatch`; body-only skips immediate index + structure bump |
| Debounced index | `useNotesStore.ts` | `scheduleBodySync` also runs `knowledgeIndexService.updateNote` + `indexContentVersion` bump |
| Dashboard memos | `useNoteViewDashboard.ts` | `[vaultStructureVersion, historyEvents]` instead of `[notes]` |
| Context panel memos | `NoteView.tsx` | Backlinks/related on `indexContentVersion`; structure memos on `vaultStructureVersion` |
| Intelligence snapshot | `useNoteViewPanels.ts` | `vaultStructureVersion` deps; shared galaxy cache |

### Reduced recomputation paths

While typing in the active note:

- `buildDiscoveryFeed` — **not rebuilt**
- `buildKnowledgeTimeline` — **not rebuilt**
- `buildUnifiedWorkspaceDashboard` — **not rebuilt**
- `extractLinkContexts` (backlinks) — **not rebuilt** until debounced index flush
- `groupRelatedNotes` — **not rebuilt** until index flush
- `buildCosmosEvolutionSummary` — **not rebuilt**

Still updates every keystroke (required for editing):

- `notes[]` in Zustand (editor body)
- Active note render / block editor

---

## P1 — Duplicate Note Body Storage

### Before

`KnowledgeIndexService.activeNotes` stored `{ title, body, updatedAt }` for every note — **full duplicate** of all bodies alongside Zustand `notes[]`.

### After

`activeNotes` stores `{ title, updatedAt }` only.

Bodies resolved at read time via:

```ts
knowledgeIndexService.setBodyProvider((noteId) =>
  useNotesStore.getState().notes.find(n => n.id === noteId)?.body ?? ''
);
```

Mention indexing still uses live body text on `updateNote(note)` call and `resolveBody()` for cross-note scans.

### Estimated memory savings

| Vault size | Avg body | Before (index bodies) | After | Savings |
|------------|----------|----------------------|-------|---------|
| 200 notes | 8 KB | ~1.6 MB | ~0 | ~1.6 MB |
| 500 notes | 8 KB | ~4.0 MB | ~0 | ~4.0 MB |
| 1000 notes | 8 KB | ~8.0 MB | ~0 | ~8.0 MB |

Metadata maps (`relatedByNoteId`, tags, edges) unchanged — bounded by vault structure.

---

## P1 — `buildNoteGalaxyMap` Caching

### Implementation

`galaxyClustering.ts`:

- `getNoteGalaxyMap(notes, service, cacheKey)` — module-level cache
- `invalidateNoteGalaxyMapCache()` — called on `vaultStructureVersion` bumps

### Single build per feed/timeline

| Consumer | Before | After |
|----------|--------|-------|
| `buildDiscoveryFeed` | 5–6 `buildNoteGalaxyMap` calls | 1 shared map passed to all signal collectors |
| `buildKnowledgeTimeline` | 2+ per bucket + milestones | 1 shared map for snapshots, area evolution, milestones |
| `buildNoteIntelligenceSnapshot` | 1 per switch (+ duplicate in tier input) | `getNoteGalaxyMap` with cache key |
| `cosmosAnalysis` | fresh build each call | `getNoteGalaxyMap` (cache hit on same structure version) |

Cache key: `String(vaultStructureVersion)`.

---

## P1 — Cosmos Render Loop Stabilization

### Before

```ts
if (simActive || (universeMode && !reducedMotion)) {
  requestAnimationFrame(step);  // perpetual
}
// setTick every frame when simActive === false in universe mode
```

### After

```ts
if (simActive) {
  // physics + throttled setTick
  requestAnimationFrame(step);
}
// loop stops when alpha < alphaFloor — no React updates while idle
```

Node drag still uses dedicated `mousemove` handler + `setTick`.

Universe orbital animation after settle is **static** until graph deps change or user drags (acceptable per scope — no algorithm replacement).

---

## Verification

```bash
npm run typecheck   # pass
npm run build       # pass
npm run test        # 1962/1962 pass
```

### Manual checks

1. Type in note — context panel backlinks should not flicker/rebuild until ~600ms pause
2. Open Cosmos — CPU should drop after graph settles (no perpetual rAF in profiler)
3. Change note title — discovery feed should refresh after structure change
4. Add `[[wiki link]]` in body — after debounce, backlinks panel updates

---

## Remaining Risks (Deferred)

| Risk | Severity | Notes |
|------|----------|-------|
| `notes[]` identity still changes per keystroke | Medium | Editor + sidebar note list still re-render; structure memos isolated |
| O(n²) force repulsion while sim active | Medium | Unchanged — algorithm not replaced |
| `extractLinkContexts` full vault scan on index flush | Medium | Debounced, not eliminated |
| Panel resize drag listener leak | Low | K-83 audit item — not in K-83A scope |
| Timeline `buildGlobalGraphData` per bucket | Medium | Galaxy shared; graph per bucket remains |
| Multi-tab storage merge | Low | Bumps `vaultStructureVersion` on external note merge |

---

## Recommended Post-K83A

1. Structural-share `notes` updates (immer/produce) to reduce editor-adjacent re-renders
2. Incremental `buildGlobalGraphData` for timeline buckets
3. Panel/gutter listener cleanup on unmount
4. Remove `[MEM-AUDIT]` diagnostics from `hotfix/k83-memory-audit` branch if merged separately

---

## Affected Files

- `useNotesStore.ts`
- `KnowledgeIndexService.ts`
- `galaxyClustering.ts`
- `discoveryEngine.ts`, `discoverySignals.ts`, `discoveryTypes.ts`
- `knowledgeTimeline.ts`, `timelineMetrics.ts`, `timelineTypes.ts`
- `cosmosAnalysis.ts`, `cosmos/index.ts`
- `useNoteViewDashboard.ts`, `useNoteViewPanels.ts`, `NoteView.tsx`
- `NoteGraphView.tsx`
