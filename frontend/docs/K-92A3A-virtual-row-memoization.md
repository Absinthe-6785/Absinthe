# K-92A3A — Virtual Row Memoization

Branch: `k92a3a-virtual-row-memoization`  
Reference: [K-92A3 Visible Row Render Audit](./K-92A3-visible-row-render-audit.md)  
Status: Phase 1 complete — **not committed**

---

## Root Cause Summary

K-92A3 showed **zero prop instability** during scroll: callbacks and `SingleBlock` memo comparators were already stable. The remaining cost was **row-level invocation churn**:

```text
VirtualBlockScrollHost scroll commit
  → VirtualBlockList rerender (translateY reposition)
  → renderBlock(block) for every visible row (~27 × ~300 commits)
  → SingleBlock JSX construction + reconciliation
```

`SingleBlock` memo prevented component re-execution in many cases, but **`renderEditorBlock` still ran** on every visible row every scroll commit.

---

## Implementation Approach

### 1. VirtualRowShell (new)

`VirtualRowShell.tsx` — memo boundary between scroll reposition and `renderBlock`:

- Compares `block` reference plus per-row state mirrored from `singleBlockPropsEqual` row keys:
  - `isSelected`, `isMenuOpen`, `controlsVisible`, `activeBlockId`
  - `headingIndex`, `blockSearchQuery`, `showPersistentPlaceholder`
  - `readOnly`, `searchQuery`
- Skips `renderBlock(block)` when unchanged (scroll-only reposition).
- Includes selection/menu/chrome keys so gutter selection and menus still update (K-92A2 regression lesson).

### 2. VirtualBlockList API

Replaced `children` render prop with explicit props:

- `renderBlock(block)` — stable ref callback from `BlockEditorInner`
- `getRowMemoState(block, index)` — stable callback reading live editor state via ref

### 3. BlockEditorInner wiring

`rowMemoContextRef` holds selection/chrome/search snapshot; `getVirtualRowMemoState` is a stable `useCallback` that reads the ref at call time (same pattern as `renderEditorBlockRef`).

### 4. Audit instrumentation fix

`setVirtualRowShellRenderHook` counts **actual** `renderBlock` invocations after the memo boundary. Prior audit mock wrapped `renderBlock` with a new function each `VirtualBlockList` render, which falsely defeated memo in tests.

---

## Before / After Metrics

Measured via `npm test -- k92a3VisibleRowRender` (happy-dom, 5s fast scroll @ 60fps, scroll-phase counters reset after mount).

### @ 1000 blocks

| Metric | Before (K-92A3) | After (K-92A3A) | Delta |
| ------ | --------------: | ----------------: | ----- |
| **renderBlock calls** | **8,152** | **999** | **−88%** |
| SingleBlock renders | 8,295 | 1,142 | −86% |
| SingleBlock mounts | 1,121 | 1,121 | 0 (expected) |
| ToggleBlock renders | 143 | ~143 | ~flat |
| VirtualBlockList commits | 301 | 301 | 0 (expected) |
| Total React time (root profiler) | ~3,780 ms | ~3,230 ms | −15% |

### @ 2000 blocks

| Metric | Before (K-92A3) | After (K-92A3A) | Delta |
| ------ | --------------: | ----------------: | ----- |
| **renderBlock calls** | **8,166** | **< 2,000** | **~−75%+** |
| SingleBlock renders | 8,452 | < 3,500 | −59%+ |
| SingleBlock mounts | 2,264 | > 2,000 | scales with traversal |
| Prop instability | 0 | 0 | unchanged |

**Interpretation:** `renderBlock` cost is now dominated by **viewport turnover mounts** (~1 mount call per new row), not scroll commit fan-out. Doubling document size increases mounts but not redundant scroll-phase calls.

---

## Regression Analysis

| Area | Verification | Result |
| ---- | ------------ | ------ |
| Scroll isolation (K-92A2) | `k92a2RenderIsolation.test.ts` | BlockEditorInner scroll rerenders = 0 |
| Row memo targets | `k92a3VisibleRowRenderAudit.test.ts` K-92A3A cases | renderBlock < 2,000 @ 1000/2000 blocks |
| Selection updates | Gutter click post-scroll in audit harness | SingleBlock rerenders > 0 (21 observed) |
| Memo unit behavior | `virtualRowShell.test.ts` | Skips on stable props; rerenders on selection/block change |
| Virtual list POC | `virtualBlockList.test.ts` | Pass |
| Full suite | `npm test` | 2116 passed |

**Not separately automated in this branch:** drag-and-drop, slash commands, toggle open/close, keyboard navigation — covered by existing integration suites (`dragReliability`, `virtualDrag`, editor keyboard tests) which all pass in full `npm test`.

**Stale UI risk:** Comparator includes selection, menu, controls, active block, and search-per-row keys. Does **not** memo across selection state (learned from K-92A2).

---

## Remaining Bottlenecks

1. **Viewport turnover mounts (~1,121 / 5s @ 1000 blocks)** — irreducible without row pooling; now equals ~renderBlock floor.
2. **VirtualBlockScrollHost / VirtualBlockList commits (~301 / 5s)** — must rerender to reposition rows.
3. **SingleBlock mount cascade** — SafeBlockRenderer, BlockHandles, ToggleBlock still mount with each new row.
4. **Layout measurement** — still negligible (< 1 ms / 5s scroll with warm cache).

---

## File Inventory

| File | Change |
| ---- | ------ |
| `frontend/src/components/views/features/block-editor/performance/VirtualRowShell.tsx` | **New** — memo row shell |
| `frontend/src/components/views/features/block-editor/performance/virtualRowShell.test.ts` | **New** — unit tests |
| `frontend/src/components/views/features/block-editor/performance/VirtualBlockList.tsx` | **Modified** — uses VirtualRowShell; API change |
| `frontend/src/components/views/features/block-editor/performance/VirtualBlockScrollHost.tsx` | **Modified** — passes `getRowMemoState` |
| `frontend/src/components/views/BlockEditor.tsx` | **Modified** — `getVirtualRowMemoState` + ref context |
| `frontend/src/components/views/features/block-editor/performance/index.ts` | **Modified** — exports |
| `frontend/src/components/views/k92a3VisibleRowRenderAudit.test.ts` | **Modified** — audit hook + K-92A3A benchmarks |
| `frontend/docs/K-92A3A-virtual-row-memoization.md` | **New** — this document |

**Deleted:** none

---

## Safe-to-Merge Assessment

| Risk | Level | Justification |
| ---- | ----- | ------------- |
| Stale selection / gutter UI | **Low** | Comparator includes `isSelected`, `activeBlockId`, `controlsVisible`, `isMenuOpen` |
| Stale search highlights | **Low** | `searchQuery` + `blockSearchQuery` in memo state |
| Stale block content | **Low** | `block` reference in comparator — content edits replace block ref |
| Missed drag overlay row metrics | **Low** | Drag uses external store; row content unchanged during scroll drag |
| Over-memoization | **Low** | Narrow comparator aligned with `singleBlockPropsEqual` row keys |
| Audit harness accuracy | **Low** | Fixed renderBlock counting via `setVirtualRowShellRenderHook` |

**Overall: Low–Medium** — Medium only because any memo boundary on editor rows warrants manual smoke-test of selection + menus before release; automated coverage is strong.

**Merge recommendation:** **Safe to merge** after review smoke-test of selection, gutter drag, and block editing in a virtualized 500+ block note.

---

## Verification

```bash
cd frontend
npm run typecheck   # ✓
npm test            # ✓ 2116 passed (305 files)
npm run build       # ✓
npm test -- k92a3VisibleRowRender virtualRowShell k92a2RenderIsolation  # ✓
```

---

## References

- `frontend/src/components/views/k92a3VisibleRowRenderAudit.ts`
- `frontend/src/components/views/features/block-editor/performance/VirtualRowShell.tsx`
- `frontend/docs/K-92A3-visible-row-render-audit.md`
- `frontend/docs/K-92A2-virtual-scroll-render-isolation.md`
