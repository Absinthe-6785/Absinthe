/**
 * External drag state store — pointer moves update subscribers without BlockEditor rerenders.
 */
import type { DragState } from '../../../editorDragDrop';
import { isDragOverUnchanged } from '../../../dragOverState';

type Listener = () => void;

let snapshot: DragState | null = null;
const listeners = new Set<Listener>();

export function getDragStateSnapshot(): DragState | null {
  return snapshot;
}

export function subscribeDragState(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function setDragStateStore(next: DragState | null): void {
  snapshot = next;
  emit();
}

export function updateDragStateOver(
  overId: string | null,
  overPos: DragState['overPos'],
): void {
  if (!snapshot) return;
  if (isDragOverUnchanged(snapshot, overId, overPos)) return;
  snapshot = { ...snapshot, overId, overPos };
  emit();
}

export function resetDragStateStore(): void {
  snapshot = null;
  listeners.clear();
}
