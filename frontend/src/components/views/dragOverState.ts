import type { DragState } from './editorDragDrop';

export type DragOverPos = 'before' | 'after' | 'inside';

/** True when drop-target fields are unchanged (skip redundant setDragState). */
export function isDragOverUnchanged(
  prev: Pick<DragState, 'overId' | 'overPos'> | null | undefined,
  overId: string | null,
  overPos: DragOverPos | null,
): boolean {
  return prev?.overId === overId && prev?.overPos === overPos;
}
