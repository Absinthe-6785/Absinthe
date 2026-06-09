/**
 * No-op drag API for tests or explicit drag-disable scenarios.
 * Production virtual drag uses real useDragDrop with row-metrics hit-test (UX-5E.1E).
 */
import type { UseDragDropResult } from '../../../editorDragDrop';

export const DISABLED_DRAG_API: UseDragDropResult = {
  bindGripPointer: () => {},
  getDragProps: (id: string) => ({
    onPointerEnter: () => {},
    'data-drag-id': id,
  }),
};
