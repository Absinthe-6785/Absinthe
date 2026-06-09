# UX-5E.1D — Drag Isolation & Virtual Drag Architecture

## Problem (UX-5D)

```
pointermove → dragState (useState) → BlockEditorInner rerender
  → dragState prop on every SingleBlock → O(N) rerenders per frame
```

## Architecture

### Drag state store (`dragStateStore.ts`)

External store with `useSyncExternalStore` subscribers. `useDragDrop` writes to the store; `BlockEditorInner` does **not** subscribe.

### Drag overlay (`DragOverlay.tsx`)

Portal-mounted drop indicators (before/after lines, toggle inside frame). Only the overlay subscribes to drag state.

### DOM sync (`dragDomSync.ts`)

Imperative updates for semantics tests and CSS:

- `.be-dragging` on dragged blocks
- `.be-toggle-drop-active` on toggle wrap/children
- `.be-drag-active` on editor root (`user-select: none`)

### Row metrics (`rowMetrics.ts`)

```ts
getRowMetrics(options) → BlockRowHit[]
resolveDropTargetFromRows(clientY, rows, draggingIds, getBlock)
```

DOM path: `listRootBlockRows`. Virtual path: `listVirtualBlockRows` (virtualizer offsets). Consumers do not import virtualizer internals directly.

## Isolation strategy

| Concern | Owner |
| --- | --- |
| Drag preview / ghost opacity | `dragDomSync` → `.be-dragging` |
| Insertion indicator | `DragOverlay` portal |
| Toggle drop highlight | `dragDomSync` → `.be-toggle-drop-active` |
| Drop commit | `useDragDrop` (unchanged) |
| Hit test (current) | `resolveDragOverFromPoint` (DOM) |
| Hit test (virtual prep) | `resolveDropTargetFromRows` |

## Virtual drag (`VIRTUAL_BLOCKS_POC=true`)

Drag remains **disabled** via `DISABLED_DRAG_API`. Row metrics and overlay contracts are in place for UX-5E.1E.

### UX-5E.1E blockers

1. Wire `resolveDropTargetFromRows` into active drag when virtual (replace `elementsFromPoint` for unmounted rows).
2. Mount `DragOverlay` under virtual POC (currently gated off with drag).
3. Pin dragged block DOM (or ghost-only) while source row unmounts.
4. Nested toggle virtualization + drag hit-test in collapsed/unmounted subtrees.
5. Gutter range selection row metrics (shared `getRowMetrics`).

## Benchmarks (invalidation model)

| Drag rerenders (per pointer move) | Before | After |
| --- | ---: | ---: |
| Root SingleBlocks | N (block count) | 0 |
| DragOverlay | 0 | 1 |

Mount @ 2000 blocks (virtual POC): unchanged target &lt;500ms (see `editorPerformanceAudit` virtual mount tests).

## Validation

```bash
npm run typecheck
npm test
npm run build
```
