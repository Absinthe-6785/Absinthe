/**
 * No-op drag API used when VIRTUAL_BLOCKS_POC is enabled.
 * Block reorder drag is disabled until UX-5E.1C virtual hit-test integration.
 */
import type { UseDragDropResult } from '../../../editorDragDrop';

export const DISABLED_DRAG_API: UseDragDropResult = {
  dragState: null,
  bindGripPointer: () => {},
  getDragProps: (id: string) => ({
    onPointerEnter: () => {},
    'data-drag-id': id,
  }),
};
