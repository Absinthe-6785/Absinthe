# K-43 Performance Audit

Hot paths: Cosmos graph, Discovery feed, Timeline, Dashboard, Workspace search.

---

## Repeated calculations (before K-43)

| Pattern | Locations | Cost |
|---------|-----------|------|
| `buildNoteGalaxyMap` | Per search match, 5× per discovery feed, per timeline snapshot bucket, milestones | O(n) graph work, multiplied |
| `buildDiscoveryFeed` | `NoteView`, `buildUnifiedWorkspaceDashboard`, `WorkspaceSearchPalette` | Triple on `notes` change |
| `buildAreaEvolution` | `buildKnowledgeTimeline` + `buildRecentEvolution` | Duplicate full pass |

All cosmos memos keyed on `[notes]` — any note edit recomputes dashboard, discovery, timeline together.

---

## Safe wins implemented (K-43)

1. **`buildWorkspaceSearch`** — hoist one `buildNoteGalaxyMap` per query build.
2. **`buildUnifiedWorkspaceDashboard`** — accept optional `discoveryFeed`; `NoteView` passes memoized feed.
3. **`WorkspaceSearchPalette`** — optional `discoveryFeed` prop; skips local rebuild when provided.
4. **`buildKnowledgeTimeline`** — compute `areaEvolution` once; pass into `buildRecentEvolution`.

---

## Opportunities deferred (K-44+)

| Opportunity | Risk | Benefit |
|-------------|------|---------|
| Single galaxy map per `buildDiscoveryFeed` | Low | High for large vaults |
| Galaxy map once per `buildSnapshots` loop | Low | Medium |
| Share galaxy map across timeline milestones + area evolution | Low | Medium |
| Debounce workspace search query memos | Low UX risk | Typing perf |
| Lazy-mount search palette hooks when closed | Medium (a11y/focus) | Skip work when closed |
| `React.memo` on dashboard cards | Low | Reduce re-render |

---

## Rerender notes

- Inline styles throughout — no memo breakage from style objects.
- `UnifiedWorkspaceDashboard` tab state is local — tab switch does not retrigger builders.
- `timelineMode` correctly isolates timeline memo deps.
