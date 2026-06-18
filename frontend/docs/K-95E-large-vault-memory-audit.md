# K-95E — Large Vault Allocator Cleanup & Final Memory Audit

Final pass over the knowledge subsystem after K-95A–D. Reduces transient allocation churn, bounds long-lived caches, and validates large-vault / long-session memory behavior.

No feature, ranking, schema, storage-layer, graph-simulation, or UI changes.

## Changes

| Area | Behavior |
|------|----------|
| **Paragraph offset cache** (`linkContextOffsetIndex.ts`) | LRU-bounded to 512 entries; stats export for audit |
| **Graph metadata** (`enrichGraphNodes.ts`) | Single `vaultNotes` array for galaxy map (no duplicate spread) |
| **Discovery feed** (`discoveryEngine.ts`) | Mem-audit uses `ctx.activeNotes.length` (no per-log filter alloc) |
| **Final audit** (`k95eLargeVaultAudit.ts`) | Combined matrix, hotspots, session sim, pre/post K-95 table |

## Audit matrix (P1)

Run `npm test -- k95eLargeVault` to print metrics at **100 / 300 / 1000 / 3000 / 10000** notes:

| Metric | Subsystems |
|--------|------------|
| Retained bytes | Index, discovery, Cosmos HUD, graph metadata, link cache |
| Transient allocations | Link excerpts, discovery refresh, renderMap model |
| Object counts | KnowledgeIndex maps + discovery pool |
| Heap growth estimate | Retained + transient blend |
| Cache sizes | Offset index, galaxy map, discovery importance / candidate pool |

## Allocation hotspots (P2)

`listK95eAllocationHotspots()` ranks churn from:

- `Map()` / `Set()` in discovery refine + feed context
- Array spreads in collector concat
- `sort()` / `filter()` in signal + section pipelines
- Graph metadata galaxy map materialization

## Cache lifecycle (P3)

| Cache | Bound | Invalidation |
|-------|-------|--------------|
| `paragraphOffsetCache` | 512 entries (LRU) | Per-note fingerprint, content version, clear |
| `getNoteGalaxyMap` | 1 memo entry | `invalidateNoteGalaxyMapCache()` |
| `DiscoveryFeedContext` | Ephemeral per refresh | GC after bundle; importance + signals scoped to context |
| Cosmos `renderMap` | Topology memo (K-92B3C1) | Regenerates on topology signature change |

## Long-session simulation (P4)

Simulates 36 ops/hour × **1h / 3h / 10h** at 1000 notes:

- Tab switch → `buildDiscoveryRefreshBundle`
- Search → `getRelatedNotes`
- Graph open → `enrichGraphNodeMeta`
- Discovery refresh → `buildDiscoveryFeed`
- Links panel → `extractLinkContexts`
- Daily navigation → incoming/outgoing lookups

Success: retained growth **< 8%**, offset cache **≤ 512**.

## Combined memory table (P6)

`runK95eCombinedMemoryTable()` compares **Pre-K95** (legacy index shapes, duplicate discovery pools, full paragraph splits, dual refresh) vs **Post-K95A–E**:

- Total retained + transient bytes
- Index, discovery, link context, candidate pool deltas
- Percentage improvements per column

## Compatibility (P7)

Tests verify unchanged behavior for:

- Backlinks / related notes
- Global graph data
- Cosmos HUD / vault analysis
- Discovery feed
- Link context excerpts

## Verification

```bash
npm run typecheck
npm test
npm run build
npm test -- k95eLargeVault
```

## K-95 series complete

```text
K-95A ✓ Discovery context sharing
K-95B ✓ Link context offset index
K-95C ✓ Knowledge index memory reduction
K-95D ✓ Discovery memory optimization
K-95E ✓ Large vault allocator cleanup and final audit
```

This concludes the K-95 memory optimization stack.
