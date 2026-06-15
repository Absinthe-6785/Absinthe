# K-70 Knowledge Intelligence & Graph Utility

K-70 increases practical value of existing knowledge systems without new storage, AI, or Cosmos engine redesign.

## Knowledge audit (Part 0)

Audited against `buildRealisticUsageDataset()` (200+ notes, 60+ events, 60+ relations).

| Finding | Action |
|--------|--------|
| Related notes ignored relation edges and recency | Relation/shared-relation scoring + grouped sections |
| Three conflicting orphan definitions | Canonical `vaultIsolation.ts` (no wiki, mentions, relations, tags) |
| Discovery lacked actionable area/isolation insights | `isolated-notes`, `recently-active-area`, `stale-area` kinds |
| Search ignored relation target titles | Tiers 7–8 in `noteSearchScore` |
| No weak-connectivity signal on strong matches | `weakConnectivity` on workspace search results |
| Cosmos HUD strong visually, thin on utility | Growing clusters, large areas, highly connected counts |
| Timeline activity feed lacked knowledge-change grouping | `RecentKnowledgeHighlights` above feed |

## Implementation map

### Related notes (`groupRelatedNotes.ts`)
- **Most Related** — highest composite score
- **Recently Connected** — `updatedAt` recency
- **Frequently Referenced** — incoming wiki link count
- Cap 12 total, 4 per section, deduplicated

### Orphan detection (`vaultIsolation.ts`)
- Discovery section: **Potentially isolated notes**
- Suggestions only — no automatic linking

### Discovery (`discoveryEngine.ts`)
- Reordered kinds: isolation and area insights first
- Vault health strip in Discovery panel

### Timeline (`recentKnowledgeHighlights.ts`)
- Recent note creation, link creation, relation resolution, major changes (high connection score)

### Cosmos (`NoteGraphView` HUD + preview panel)
- Highly connected, growing clusters, large areas
- Preview: highly connected / isolated indicators

### Search (`buildWorkspaceSearch.ts`)
- Relation target titles passed to `noteSearchScore`
- `weakConnectivity` when strong match + `connectionCount <= 1`

### Vault health (`vaultHealthMetrics.ts`)
- Connected notes, isolated notes, avg links/note, recently active (7d)

## Performance

- All features use existing `KnowledgeIndexService` indexes
- O(N) vault health and isolation scans — no background workers
- Related notes capped at 12; discovery per-section limit 3

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

Key tests: `knowledgeIntelligenceAudit.test.ts`, `vaultIsolation.test.ts`, `groupRelatedNotes.test.ts`, `vaultHealthMetrics.test.ts`.

## Remaining UX debt

- Relation creation not a first-class history event type (uses `DISCOVERY_RESOLVED`)
- Fast-growing topics still overlap with `emerging-topic` — could merge later
- Cosmos label density in very large graphs unchanged (no engine rewrite)
- Automatic linking suggestions still manual-only by design
