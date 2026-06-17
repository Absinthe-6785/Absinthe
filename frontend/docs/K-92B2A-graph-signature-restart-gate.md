# K-92B2A — Graph Signature Restart Gate

**Branch:** `k92b2a-graph-signature-restart-gate`  
**Reference:** [K-92B2](./K-92B2-incremental-sim-restart-audit.md), [K-92B1B](./K-92B1B-cosmos-warm-reheat.md)  
**Status:** Implemented — topology-gated sim restart  
**Scope:** Restart force sim only when graph topology signature changes

---

## Architecture Summary

Before K-92B2A, the Cosmos force simulation `useEffect` in `NoteGraphView.tsx` restarted whenever `vaultStructureVersion` or `indexContentVersion` changed. Those counters bump on metadata edits (title, tag, star, body-only) even when node ids and edge pairs are unchanged.

K-92B2A introduces a canonical **graph topology signature** derived from sorted node ids and sorted edge triples (`sourceId|targetId|relationshipType`). The force sim effect now depends on `graphTopologySignature` instead of store version counters.

```text
buildGlobalGraphData (still keyed on vault/index versions + filter)
        │
        ▼
graphTopologySignature = buildGraphTopologySignatureFromGraphData(graphData)
        │
        ├─ node init effect [graphData] — labels/metadata refresh, preserves x/y
        │
        └─ force sim effect [graphTopologySignature, size, filter, mode, reducedMotion]
              │
              ├─ signature unchanged → effect does not re-run → 0 restarts
              └─ signature changed   → warm reheat α=0.2 (K-92B1B policy)
```

`resolveCosmosSimInitialAlpha()` in `cosmosSimReheat.ts` now compares `graphTopologySignature` (not vault/index versions) to decide warm vs cold alpha when the effect does restart.

---

## File Inventory

| File | Role |
|------|------|
| `frontend/src/components/views/cosmosGraphSignature.ts` | Signature builder |
| `frontend/src/components/views/cosmosGraphSignature.test.ts` | Signature unit tests |
| `frontend/src/components/views/cosmosSimReheat.ts` | Warm/cold alpha policy on signature change |
| `frontend/src/components/views/cosmosSimReheat.test.ts` | Reheat policy tests |
| `frontend/src/components/views/NoteGraphView.tsx` | Wired signature + effect deps |
| `frontend/src/components/views/k92b1CosmosForceSimAudit.ts` | Updated `effectRestartDeps` snapshot |
| `frontend/src/components/views/k92b2CosmosIncrementalSimAudit.ts` | Catalog + deps aligned with fix |
| `frontend/src/components/views/k92b2aGraphSignatureRestartAudit.ts` | Before/after benchmark harness |
| `frontend/src/components/views/k92b2aGraphSignatureRestartAudit.test.ts` | Targeted verification tests |
| `frontend/docs/K-92B2A-graph-signature-restart-gate.md` | This document |

---

## Before / After Benchmark (metadata-only edit)

Deterministic tick counts from `countAlphaTicks(αFloor, 0.97, 0.2)`. Run: `npm test -- k92b2aGraphSignature`.

| Notes | Scenario | Before restarts | Before ticks | Before settles | After restarts | After ticks | After settles |
| ----: | -------- | --------------: | -----------: | ---------------: | -------------: | ----------: | ------------: |
| 100 | metadata_only | 1 | 122 | 1 | 0 | 0 | 0 |
| 300 | metadata_only | 1 | 76 | 1 | 0 | 0 | 0 |
| 500 | metadata_only | 1 | 76 | 1 | 0 | 0 | 0 |
| 1000 | metadata_only | 1 | 76 | 1 | 0 | 0 | 0 |
| 100 | link_add | 1 | 122 | 1 | 1 | 122 | 1 |
| 300 | link_add | 1 | 76 | 1 | 1 | 76 | 1 |
| 500 | link_add | 1 | 76 | 1 | 1 | 76 | 1 |
| 1000 | link_add | 1 | 76 | 1 | 1 | 76 | 1 |
| 100 | link_remove | 1 | 122 | 1 | 1 | 122 | 1 |
| 300 | link_remove | 1 | 76 | 1 | 1 | 76 | 1 |
| 500 | link_remove | 1 | 76 | 1 | 1 | 76 | 1 |
| 1000 | link_remove | 1 | 76 | 1 | 1 | 76 | 1 |

Topology edits (`link_add`, `link_remove`) still incur **1 restart** and warm tick counts unchanged from K-92B1B.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Signature misses a topology change | High | Edge triple includes `relationshipType`; node add/remove changes node list |
| Signature false positive on filter change | Low | Filter changes rebuild `graphData` → different edges in signature; sim still restarts via filter dep |
| Stale sim running after metadata edit | Low | Node init effect still runs on `graphData`; only force loop skipped |
| Panel resize still warm-restarts | Expected | `size.w/h` remain in effect deps (unchanged from K-92B2 audit) |
| Performance of signature build | Low | O(n + e) sort on each graphData rebuild; negligible vs O(n²) settle |

**Out of scope (K-92B2B):** incremental local reheat, Barnes-Hut, workers, render throttling, force constants.

---

## Verification

```bash
cd frontend
npm run typecheck
npm test
npm run build
npm test -- k92b2aGraphSignature
```

Targeted assertions:

- Title edit → signature unchanged → no sim restart
- Tag edit → signature unchanged → no sim restart
- Link add → signature changed → restart
- Link remove → signature changed → restart
