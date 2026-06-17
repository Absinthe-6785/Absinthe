# K-92A3 — Visible Row Render Audit

Branch: `k92a3-visible-row-render-audit`  
Reference: [K-92A2 Virtual Scroll Render Isolation](./K-92A2-virtual-scroll-render-isolation.md)  
Status: Audit only — **no production behavior changes**

---

## Executive Summary

After K-92A2 eliminated `BlockEditorInner` scroll rerenders (1635 → 0), **~8k SingleBlock profiler hits remain during 5s fast scroll** at 1000 blocks. This audit attributes that volume to:

1. **Viewport turnover mounts (~1140)** — new block rows entering the virtual window (unavoidable without content caching).
2. **renderBlock fan-out (~8150 calls)** — `VirtualBlockList` invokes `renderBlock(block)` for every visible row on every scroll commit (~300 commits × ~27 rows).
3. **Stable props during scroll (0 prop changes detected)** — `SingleBlock` memo comparators pass; remaining cost is reconciliation + mount, not prop instability.
4. **Child row cascade** — `SafeBlockRenderer`, `BlockHandles`, and toggle subtrees mount in lockstep with new rows.

**Not scroll bottlenecks:** SelectionToolbar, DragOverlay (no scroll subscriptions on rows), Zustand (none in editor), context updates (providers stable during scroll post-K-92A2).

**Recommendation:** **K-92A3A Row Memoization** — skip `renderBlock` JSX construction for unchanged `(blockId, selection state)` at the virtual row boundary.

---

## Methodology

| Source | What it measures |
|--------|------------------|
| `k92a3VisibleRowRenderAudit.ts` | 5s fast scroll @ 60fps, virtual editor @ 1000/2000 blocks |
| React Profiler wrappers | Per-component render count, mount vs update, duration |
| Prop snapshot diff | Same `blockId` consecutive `renderBlock` calls — 43 SingleBlock props |
| Static trace | Contexts, external stores, memo boundaries |
| K-92A2 baseline | Prior `k92a2ScrollAttributionAudit` numbers |

Run:

```bash
cd frontend
npm test -- k92a3VisibleRowRender
```

Environment: Vitest + happy-dom, 2026-06-17. Scroll-phase counters reset after mount.

---

## A. Render Attribution Report

### @ 1000 blocks — 5s fast scroll

| Component | Renders | Mounts | Rerenders | Total ms | Avg ms | Trigger source |
|-----------|--------:|-------:|----------:|---------:|-------:|----------------|
| **VirtualBlockScrollHost** | 301 | 0 | 301 | 3,388 | 11.26 | Scroll → `useVirtualizer` offset commits |
| **VirtualBlockList** | 301 | 0 | 301 | 3,290 | 10.93 | Host rerender → `getVirtualItems()` reposition |
| **SingleBlock** | 8,295 | 1,121 | 7,174 | 2,788 | 0.34 | renderBlock fan-out + viewport turnover mounts |
| **SafeBlockRenderer** | 999 | 981 | 18 | 724 | 0.73 | SingleBlock mount cascade |
| **ToggleBlock** | 143 | 140 | 3 | 605 | 4.23 | Toggle rows entering viewport (~14% of blocks) |
| **BlockHandles** | 1,142 | 1,121 | 21 | 484 | 0.42 | New gutter chrome per mount |
| **BlockGutter** | (included in row) | — | — | — | — | Same mount pattern as handles |
| **SelectionToolbar** | 144 | 140 | 4 | 5 | 0.03 | Initial mount only; **not scroll-driven** |

**Scroll-phase aggregates:**

| Metric | Value |
|--------|------:|
| `renderBlock` calls | 8,152 |
| Viewport turnover mounts | 1,140 |
| Prop instability (same block, consecutive calls) | **0 changes** |
| Selection interaction → SingleBlock rerenders | 21 (post-scroll gutter click) |

### @ 2000 blocks — 5s fast scroll

| Component | Renders | Mounts | Rerenders | Total ms |
|-----------|--------:|-------:|----------:|---------:|
| SingleBlock | 8,452 | 2,264 | 6,188 | 5,478 |
| renderBlock calls | 8,166 | — | — | — |
| Viewport turnover mounts | 2,283 | — | — | — |
| Prop instability | **0 changes** | — | — | — |

**Interpretation:** SingleBlock render count scales with **document traversal distance**, not BlockEditorInner propagation. Doubling blocks doubles mounts (~1140 → 2283) while renderBlock calls stay ~8160.

---

## B. Top 20 Render Hotspots

Ranked by **total render time** @ 1000 blocks:

| Rank | Component | Renders | Total ms | Avg ms | Frequency driver |
|------|-----------|--------:|---------:|-------:|------------------|
| 1 | VirtualBlockScrollHost | 301 | 3,388 | 11.26 | Scroll commits |
| 2 | VirtualBlockList | 301 | 3,290 | 10.93 | Scroll commits |
| 3 | SingleBlock | 8,295 | 2,788 | 0.34 | Mount + reconciliation |
| 4 | SafeBlockRenderer | 999 | 724 | 0.73 | Row mount cascade |
| 5 | ToggleBlock | 143 | 605 | 4.23 | Toggle row mounts |
| 6 | BlockHandles | 1,142 | 484 | 0.42 | Row mount cascade |
| 7 | BlockGutter | ~1,142 | ~similar | ~0.4 | Row mount cascade |
| 8 | SelectionToolbar | 144 | 5 | 0.03 | Initial only |
| 9–20 | *(no other components exceed 5 ms total during scroll)* | — | — | — | — |

Ranked by **render frequency** @ 1000 blocks:

| Rank | Component | Renders |
|------|-----------|--------:|
| 1 | SingleBlock | 8,295 |
| 2 | BlockHandles | 1,142 |
| 3 | SafeBlockRenderer | 999 |
| 4 | renderBlock calls | 8,152 |
| 5 | VirtualBlockScrollHost | 301 |
| 6 | VirtualBlockList | 301 |
| 7 | ToggleBlock | 143 |
| 8 | SelectionToolbar | 144 |

---

## C. Render Cascade Graph

### Scroll path (dominant)

```text
scroll (.editor-drop-zone)
  ↓
VirtualBlockScrollHost          ← useVirtualizer state (isolated from BlockEditorInner)
  ↓
VirtualBlockList                ← getVirtualItems() + translateY reposition
  ↓
renderBlock(block) × ~27 rows   ← stable callback; builds JSX every commit
  ↓
SingleBlock (React.memo)        ← props STABLE during scroll → memo bails actual render
  │                               (profiler wrapper still reconciles parent element)
  ├─ BlockGutter
  │    └─ BlockHandles          ← new React element refs every renderBlock call
  ├─ SafeBlockRenderer          ← mounts with new rows
  │    └─ renderBlockContent
  │         └─ EditableBlock / blockRegistry
  └─ ToggleBlock (memo)         ← 140 mounts; ctx/gutterChrome ignored by comparator
       └─ nested BlockEditorInner (depth>0, NOT virtualized)
```

### Selection path (interaction, not scroll)

```text
gutter pointerdown
  ↓
useEditorSelection → setSelectedBlockIds
  ↓
BlockEditorInner rerender       ← expected; selection is editor state
  ↓
VirtualBlockScrollHost rerender (child of inner)
  ↓
SingleBlock rows where isSelected changed (~21 rerenders measured)
```

### Drag path (static — not in scroll audit)

```text
grip pointerdown
  ↓
dragStateStore.setDragStateStore
  ↓
DragOverlay (useSyncExternalStore)   ← isolated; SingleBlock NOT subscribed
  ↓
VirtualBlockScrollHost pin indices   ← extra rows mounted during drag only
```

### Toolbar path (not scroll)

```text
text selection in editable
  ↓
SelectionToolbar (sibling of block list, depth=0)
  ↓
No coupling to SingleBlock scroll rerenders
```

---

## D. Subscription Audit

### External stores (non-React)

| Store | Subscribers | Scroll coupling |
|-------|-------------|-----------------|
| `dragStateStore` | `DragOverlay` via `useSyncExternalStore` | **None** during scroll; drag only |
| `virtualScrollStore` | Row metrics readers (ref getters) | Read-only; no React subscription |
| `tocScrollStore` | TOC outline only (K-92A1) | **None** on editor rows |

### React contexts

| Context | Provider location | Value stability on scroll | Row consumers |
|---------|-------------------|---------------------------|---------------|
| `BlocksCtx` | BlockEditorInner | **Stable** (`useMemo` on `onChange`) | SingleBlock `useBlocksCtx` |
| `SelectionCtx` | BlockEditorInner | **Stable** (BlockEditorInner doesn't rerender) | SingleBlock via props, not direct ctx |
| `DragCtx` | BlockEditorInner | **Stable** on scroll | SingleBlock via `bindGripPointer` props |
| `VirtualNavigationCtx` | BlockEditorInner | **Stable** (`navigationApi` memo) | SingleBlock `useVirtualNavigation` |

### useSyncExternalStore consumers in editor

| Hook | Component | Row-level? |
|------|-----------|------------|
| `useDragStateSnapshot` | `DragOverlay` only | No |

### Memo boundaries

| Component | Memo | Scroll behavior |
|-----------|------|-----------------|
| `BlockEditor` | `React.memo` | Stable during scroll |
| `BlockEditorInner` | none | **0 rerenders on scroll** (K-92A2) |
| `SingleBlock` | `React.memo` + 43-prop comparator | Props stable; mounts on turnover |
| `ToggleBlock` | `React.memo` (K-92A2) | 140 mounts, 3 rerenders / 5s scroll |
| `VirtualBlockScrollHost` | none | 301 rerenders (scroll owner — expected) |
| `VirtualBlockList` | none | Must rerender to reposition rows |

### Zustand

**None** in block editor path. (`HealthView` only — unrelated.)

---

## E. Optimization Opportunities

### Low risk

| Opportunity | Expected gain | Notes |
|-------------|---------------|-------|
| **K-92A3A: Virtual row shell memo** — skip `renderBlock(block)` when `(block ref, isSelected, isMenuOpen, controlsVisible)` unchanged | **High** — eliminates ~7000 reconciliation passes | Must include selection props in comparator; do NOT memo across selection changes |
| **Stable `gutterChrome` element** — memoize handles subtree per `blockId` | Medium | Reduces BlockHandles/SafeBlockRenderer churn |
| **Profiler-confirmed inner mount budget** — accept ~1140 mounts/5s as floor for 1000-block traverse | Baseline | Cannot eliminate without row pooling |

### Medium risk

| Opportunity | Expected gain | Notes |
|-------------|---------------|-------|
| **K-92A3B: Selection isolation** — external selection store + per-row `useSyncExternalStore` | Medium on selection; low on scroll | Scroll already clean; helps multi-select / gutter |
| **Row content pooling** — reuse SingleBlock instance for same blockId leaving/entering viewport | High mount reduction | Complex focus/editable state restore |
| **Reduce VirtualBlockScrollHost rerenders** — store scroll offset externally, position rows imperatively | Medium | Fights React model; high engineering cost |

### High risk

| Opportunity | Expected gain | Notes |
|-------------|---------------|-------|
| **K-92A3C: Toolbar isolation** | Low scroll impact | Toolbar not scroll bottleneck (5 ms total) |
| **K-92A3D: Store subscription reduction** | Minimal | No row-level store subscriptions exist today |
| **Nested toggle virtualization** | High on toggle-heavy notes | Separate from scroll row churn |

---

## F. Recommendation

### Choose: **K-92A3A Row Memoization**

**Justification:**

1. Prop audit shows **zero prop instability** during scroll — memo already works at the `SingleBlock` layer, but **`renderBlock` is still invoked 8152 times**, constructing JSX, gutter elements, and `renderCtx` objects each time.
2. **Viewport turnover (~1140 mounts)** is the irreducible floor for a full 1000-block traverse; optimization should target the **~7000 redundant reconciliation passes** on rows that stay mounted with identical props.
3. Selection isolation (K-92A3B) helps interaction paths (21 rerenders on gutter click) but not scroll.
4. Toolbar isolation (K-92A3C) — SelectionToolbar total cost **5 ms / 5s**; not worth priority.
5. Store reduction (K-92A3D) — no row-level subscriptions to remove.

**Proposed K-92A3A scope:**

- Add `VirtualRowContent` memo at `VirtualBlockList` level keyed on `(block, isSelected, isMenuOpen, controlsVisible)` passed from stable row props snapshot.
- Do **not** memo across selection state (learned from K-92A2 regression).
- Target metric: renderBlock calls **8152 → ~1200–1500** (mounts + selection deltas only).

**Safe next-step branch:** `k92a3a-virtual-row-memoization`

---

## Historical Comparison

| Metric | Pre-K-92A2 | Post-K-92A2 | K-92A3 finding |
|--------|----------:|------------:|---------------|
| BlockEditorInner scroll rerenders | 1,635 | **0** | Confirmed isolated |
| SingleBlock renders / 5s @ 1000 | 9,612 | 8,295 | **Mounts + renderBlock fan-out** |
| ToggleBlock renders | 1,335 | 143 | Memo effective |
| Prop changes during scroll | (not measured) | **0** | Memo props stable |
| renderBlock calls | (not measured) | **8,152** | Primary optimization target |

---

## Verification

```bash
cd frontend
npm run typecheck   # ✓
npm test            # ✓ 2111 passed
npm run build       # ✓
npm test -- k92a3VisibleRowRender  # ✓ audit harness
```

---

## References

- `frontend/src/components/views/k92a3VisibleRowRenderAudit.ts`
- `frontend/src/components/views/k92a3VisibleRowRenderAudit.test.ts`
- `frontend/src/components/views/k92a2ScrollAttributionAudit.ts`
- `frontend/docs/K-92A2-virtual-scroll-render-isolation.md`
- `frontend/src/components/views/features/block-editor/components/SingleBlock.tsx`
