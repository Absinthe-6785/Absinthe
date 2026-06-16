# K-92A2 — Virtual Scroll Render Isolation

Branch: `k92a2-virtual-scroll-render-isolation`  
Reference: [K-92A2 Scroll Attribution Audit](./K-92A2-scroll-attribution-audit.md) (merged via `k92a2ScrollAttributionAudit.ts`)  
Status: Phase 1 complete — **not committed**

---

## Root Cause Summary

The K-92A2 attribution audit disproved the original K-92A hypothesis (virtualization measurement / `measureElement` layout reads). Scroll jank is dominated by **React render propagation**:

```text
scroll
  → useVirtualizer state update (inside BlockEditorInner)
  → BlockEditorInner full hook chain rerender
  → VirtualBlockList rerender
  → all visible SingleBlock / ToggleBlock rows reconcile
```

`useVirtualBlockList` lived inside `BlockEditorInner`, so every scroll offset commit reran the ~800-line editor hook graph even when document state was unchanged.

---

## Architecture Changes

### 1. VirtualBlockScrollHost (new)

`VirtualBlockScrollHost.tsx` owns:

- `useVirtualBlockList` (TanStack virtualizer)
- `VirtualBlockList` rendering
- `virtualScrollStore` registration
- `virtualScrollApiRef` (`scrollToBlockId`, `getBlockScrollTop`)
- `setVirtualizationStatsSource`

`BlockEditorInner` passes a **stable** `renderBlock` callback (ref indirection) so scroll commits do not require parent rerenders.

### 2. virtualScrollStore (new)

External snapshot (same pattern as `dragStateStore` / `tocScrollStore`):

- `virtualizer`, `heightCache`, `scrollToBlockId`, `getBlockScrollTop`
- Consumed by drag row metrics, TOC heading fallback, document focus — without subscribing BlockEditorInner to scroll.

### 3. BlockEditorInner decoupling

Removed from scroll hot path:

- `useVirtualBlockList`
- Virtualization stats effect
- `virtualScrollApiRef` registration effect
- Direct `virtualList.virtualizer` dependencies

Added:

- `scrollToBlockIdViaStore` stable wrapper for `createVirtualNavigationApi`
- `renderVirtualBlock` stable callback via `renderEditorBlockRef`
- `useRenderDiagnostic('BlockEditorInner')` (DEV/test)

### 4. Row-level memo hardening

| Component | Change |
|-----------|--------|
| `SingleBlock` | Already `React.memo`; added `onClearBlockSelection` to comparator; stable `EMPTY_SELECTION_IDS` / `noopBlockSelect` |
| `ToggleBlock` | New `React.memo` + `toggleBlockPropsEqual` (ignores unstable `ctx` / `gutterChrome` references) |
| `VirtualBlockList` | Unchanged function component (must rerender on scroll to reposition rows) |

---

## Before / After Metrics

Measured via `npm test -- k92a2ScrollAttribution` (happy-dom, 5s fast scroll @ 60fps, scroll-phase counters reset after mount).

### @ 1000 blocks

| Metric | Before (attribution audit) | After (Phase 1) | Change |
|--------|---------------------------:|----------------:|--------|
| **BlockEditorInner scroll rerenders** | **1,635** | **0** | **−100%** |
| VirtualBlockList commits | 443 | 300 | −32% (1/event) |
| SingleBlock profiler renders | 9,612 | 8,274 | −14% |
| ToggleBlock profiler renders | 1,335 | 140 | −89% |
| Total React profiler time | 2,656 ms | 2,611 ms | ~flat |
| Layout read time | 0.25 ms | 0.25 ms | unchanged |

### @ 2000 blocks

| Metric | Before | After | Change |
|--------|-------:|------:|--------|
| **BlockEditorInner scroll rerenders** | **1,781** | **0** | **−100%** |
| VirtualBlockList commits | 586 | 300 | −49% |
| SingleBlock profiler renders | 9,915 | 8,431 | −15% |
| ToggleBlock profiler renders | 1,481 | 283 | −81% |
| Total React profiler time | 4,279 ms | 3,578 ms | −16% |
| Layout read time | 0.48 ms | 0.48 ms | unchanged |

### Isolation guardrail

`k92a2RenderIsolation.test.ts`:

```text
scroll → VirtualBlockScrollHost rerenders > 0
scroll → BlockEditorInner rerenders = 0
```

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Stale row UI during scroll | Low | Selection/edit paths still rerender BlockEditorInner → VirtualBlockScrollHost as child |
| `virtualScrollStore` null during mount | Low | Row metrics / TOC fallback return null-safe defaults until host effect runs |
| ToggleBlock memo too aggressive | Low | Comparator excludes unstable `ctx`/`gutterChrome`; toggle content still updates when `block` ref changes |
| Drag / gutter regressions | Medium | Fixed `dragReliability` autoscroll test to drag a mounted block at non-zero scrollTop |
| SingleBlock still high render count | Medium | Expected for newly mounted rows entering viewport; further row-level caching deferred |

---

## Remaining Bottlenecks

1. **SingleBlock mount churn** (~8k profiler hits / 5s scroll @ 1000 blocks) — mostly new rows entering viewport, not BlockEditorInner propagation.
2. **VirtualBlockScrollHost** rerenders once per scroll event (~300/5s) — expected; now the isolated scroll boundary.
3. **VirtualBlockList row reposition** — must run on scroll; cannot memo the list itself.
4. **Layout measurement** — still negligible (<1 ms / 5s scroll with warm cache).

---

## Follow-Up Recommendations

| Priority | Branch / scope |
|----------|----------------|
| P1 | Memoized row shell keyed by `(blockId, revision)` to skip `renderEditorBlock` JSX build for stable rows |
| P2 | K-92A3 context panel decoupling (unchanged — not scroll critical) |
| P3 | Defer `measureElement` optimization unless cold-cache / edit remeasurement profiled in Chrome |

---

## Verification

```bash
cd frontend
npm run typecheck   # ✓
npm test            # ✓ 2109 passed (304 files)
npm run build       # ✓
npm test -- k92a2ScrollAttribution k92a2RenderIsolation  # ✓ isolation + benchmarks
```

---

## References

- `frontend/src/components/views/k92a2ScrollAttributionAudit.ts`
- `frontend/src/components/views/features/block-editor/performance/VirtualBlockScrollHost.tsx`
- `frontend/src/components/views/features/block-editor/performance/virtualScrollStore.ts`
- `frontend/docs/K-92A-editor-performance-audit.md`
