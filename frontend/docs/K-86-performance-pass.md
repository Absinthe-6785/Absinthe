# K-86 Performance Pass

Runtime cost reduction for the Notes workspace without UI or schema changes.

## Before vs after architecture

### Before

- **Context panel:** All tab data (links, graph, insights, properties, discover, timeline) computed in `NoteView.tsx` on every active note, regardless of `rightPanel`.
- **Dashboard:** `useNoteViewDashboard` built discovery feed + knowledge timeline on every note session.
- **Cosmos:** `NoteGraphView` statically imported; `visibleKey` (`id:updatedAt`) rebuilt global graph on every body keystroke while Cosmos was open; HUD ran `buildCosmosVaultAnalysis` + `buildDiscoveryFeed` synchronously on mount; `enrichGraphNodeMeta` called uncached `buildNoteGalaxyMap`.
- **Sidebar:** `visibleNotes.map` rendered all rows; `visibleNotes` memo depended on full `notes[]` (invalidated every keystroke).
- **Archive:** `useArchiveHomeProjection` depended on `notes[]`.
- **App shell:** All workspace views eagerly imported in `AppContent.tsx`.

### After

- **Tab-gated context:** `contextPanelTabGate.ts` drives per-tab activation; expensive memos run only when the matching tab is open (links / graph / insights / properties / relations / tags).
- **Scoped dashboard:** `resolveDashboardLoadScope()` limits discovery feed, timeline, and workspace dashboard builds to dashboard mode, discover/timeline tabs, or Cosmos view.
- **On-demand Cosmos:** `NoteGraphViewLazy` + `React.lazy`; graph topology keyed on `vaultStructureVersion` + `indexContentVersion`; HUD analysis deferred via `requestIdleCallback`; galaxy enrichment uses cached `getNoteGalaxyMap`.
- **Virtual sidebar:** `NoteSidebarVirtualList` (`@tanstack/react-virtual`, threshold 40 notes).
- **Version-keyed projections:** Sidebar list, archive projection, relations, vault health use `vaultStructureVersion` / `indexContentVersion` instead of `notes[]` deps.
- **Lazy app views:** Planner, Health, Analytics, Settings, Recipe loaded on tab activation.

## Expensive paths removed

| Path | Change |
|------|--------|
| Hidden Links tab | No `backlinkContexts`, `groupedRelatedNotes`, `conceptHub`, `learningPath`, bibliography |
| Hidden Graph tab | No `localGraphData` / `buildExpandedGraphData` |
| Hidden Insights tab | No `buildNoteIntelligenceSnapshot`, galaxy tier input |
| Hidden Properties tab | No `buildProjectEditorData`, source candidates |
| Hidden Relations/Tags | No relation resolution / `getAllTags` |
| Closed context panel | No `logMemAudit` context spam |
| Edit mode (no Cosmos) | No `NoteGraphView` mount, no force simulation |
| Idle Notes session | No discovery feed or timeline unless tab/dashboard/graph needs them |

## Lazy-loading coverage

| Module | Mechanism |
|--------|-----------|
| `NoteGraphView` | `NoteGraphViewLazy` → `React.lazy` + `Suspense` |
| `PlannerView`, `HealthView`, `AnalyticsView`, `SettingsView`, `RecipeView` | `React.lazy` in `AppContent.tsx` |
| Cosmos HUD analysis | `requestIdleCallback` after graph mount |
| Dashboard discovery/timeline | `loadScope` flags in `useNoteViewDashboard` |

## Virtualization coverage

| Surface | Implementation |
|---------|----------------|
| Notes sidebar (All / Recent / Favorites / filtered) | `NoteSidebarVirtualList`, 72px rows, overscan 8, threshold 40 |
| Block editor (pre-existing) | `useVirtualBlockList` |
| Timeline activity feed (pre-existing) | `TimelineActivityFeed` |

Archive home uses a bounded 2×2 grid; projection is version-keyed. Milestone list remains small by design (recent slice).

## Performance instrumentation

- `memAudit.ts` already no-ops in production (`import.meta.env.PROD`).
- Context and dashboard memAudit effects gated behind panel/dashboard activity.

## Remaining performance debt

1. **Active note body in store** — `notes[]` reference still changes on keystroke; editor and active row preview still rerender (acceptable).
2. **Cosmos while open** — force simulation still runs when graph view is active; further wins need spatial indexing or WebGL (out of scope).
3. **Database / trace workspace panels** — not virtualized; lower traffic than main note list.
4. **Archive calendar heatmap** — fixed year span; no virtualization needed yet.
5. **Full-app code split** — `NoteView` remains eager (default tab).

## Recommended future optimizations

1. Split `NoteView.tsx` tab data into dedicated hooks with LRU cache per `(noteId, tab, vaultStructureVersion)`.
2. Virtualize `DatabaseViewPanel` note tables for 500+ row views.
3. Web Worker for `buildGlobalGraphData` on vaults > 1000 notes.
4. `React.memo` on sidebar row primitives if profiling shows row rerender cost.
5. Remove K-83 `memAudit` entirely once OOM investigation is closed.

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

All three must pass before merge.
