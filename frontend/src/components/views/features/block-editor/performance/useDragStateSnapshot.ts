import { useSyncExternalStore } from 'react';
import type { DragState } from '../../../editorDragDrop';
import { getDragStateSnapshot, subscribeDragState } from './dragStateStore';

/** Subscribe to drag state without rerendering BlockEditor / SingleBlock. */
export function useDragStateSnapshot(): DragState | null {
  return useSyncExternalStore(subscribeDragState, getDragStateSnapshot, getDragStateSnapshot);
}
