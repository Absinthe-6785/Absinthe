# UX-5E.1E — Virtual Drag Enablement

## Virtual drag flow

```
grip pointerdown (virtual root)
  → useDragDrop (external dragStateStore)
  → pointermove
      → resolveDragOverFromPoint (mounted DOM: nested/toggle footer)
      → resolveDropTargetFromRows (virtual row metrics fallback)
  → DragOverlay (portal indicators + ghosts)
  → dragDomSync (.be-dragging on mounted blocks)
  → pointerup → commitDragDrop (unchanged semantics)
```

## Overlay ownership

| Visual | Owner | Virtual behavior |
| --- | --- | --- |
| Drop line (before/after) | `DragOverlay` | `resolveOverlayFrame` → row metrics when DOM absent |
| Toggle inside frame | `DragOverlay` | Same |
| Drag opacity (mounted) | `dragDomSync` | `.be-dragging` on live DOM |
| Drag ghost (unmounted) | `DragOverlay` | `.be-drag-ghost` from row metrics |
| user-select none | `dragDomSync` | `.be-drag-active` on editor root |

## RowMetrics integration

`BlockEditor` passes `resolveVirtualDragOver` to `useDragDrop` when `VIRTUAL_BLOCKS_POC` is on:

1. DOM hit-test first (nested blocks, toggle drop zones)
2. `getRowMetrics` → `resolveDropTargetFromRows` for root rows

`useVirtualBlockList` pins dragged/over indices during drag to reduce unmount churn.

## UX-5E.1F blockers (production default)

1. Default `VIRTUAL_BLOCKS_POC` on (env / feature flag rollout)
2. Nested toggle virtualization
3. Virtual gutter range selection (`getRowMetrics` for gutter drag)
4. Production hardening: telemetry, edge-case QA at scale
5. Remove non-virtual code path when stable

## Validation

```bash
npm run typecheck  # PASS
npm test           # PASS (792 tests)
npm run build      # PASS
```

Virtual mount @ 2000 blocks: unchanged &lt;500ms target (`editorPerformanceAudit`).

Drag invalidation: 0 `SingleBlock` rerenders per pointer move (UX-5E.1D model preserved).
