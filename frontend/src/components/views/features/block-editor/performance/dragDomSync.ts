/**
 * Imperative drag chrome — keeps .be-dragging / toggle drop classes off the React tree.
 */
import type { DragState } from '../../../editorDragDrop';

const DRAGGING_CLASS = 'be-dragging';
const TOGGLE_DROP_CLASS = 'be-toggle-drop-active';
const DRAG_SESSION_CLASS = 'be-drag-active';

function blockEl(id: string): HTMLElement | null {
  return document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement | null;
}

function toggleWrapForBlock(blockId: string): HTMLElement | null {
  const header = blockEl(blockId);
  return header?.closest('.be-toggle-wrap') as HTMLElement | null;
}

function toggleChildrenEl(toggleId: string): HTMLElement | null {
  return document.querySelector(
    `.be-toggle-children[data-toggle-id="${toggleId}"]`,
  ) as HTMLElement | null;
}

function setDraggingClass(id: string, on: boolean): void {
  const el = blockEl(id);
  if (!el) return;
  el.classList.toggle(DRAGGING_CLASS, on);
}

function setToggleDropActive(toggleId: string | null): void {
  document.querySelectorAll(`.${TOGGLE_DROP_CLASS}`).forEach(node => {
    node.classList.remove(TOGGLE_DROP_CLASS);
  });
  if (!toggleId) return;
  toggleWrapForBlock(toggleId)?.classList.add(TOGGLE_DROP_CLASS);
  toggleChildrenEl(toggleId)?.classList.add(TOGGLE_DROP_CLASS);
}

function setDragSessionActive(on: boolean, getEditorRoot?: () => HTMLElement | null): void {
  const root = getEditorRoot?.() ?? document.querySelector('.be-editor-root');
  if (!(root instanceof HTMLElement)) return;
  root.classList.toggle(DRAG_SESSION_CLASS, on);
}

let prevDraggingIds: string[] = [];
let prevOverInsideId: string | null = null;

export function syncDragDom(
  state: DragState | null,
  getEditorRoot?: () => HTMLElement | null,
): void {
  if (!state) {
    for (const id of prevDraggingIds) setDraggingClass(id, false);
    prevDraggingIds = [];
    setToggleDropActive(null);
    setDragSessionActive(false, getEditorRoot);
    prevOverInsideId = null;
    return;
  }

  const nextDragging = state.draggingIds;
  for (const id of prevDraggingIds) {
    if (!nextDragging.includes(id)) setDraggingClass(id, false);
  }
  for (const id of nextDragging) {
    if (!prevDraggingIds.includes(id)) setDraggingClass(id, true);
  }
  prevDraggingIds = [...nextDragging];

  const insideId = state.overPos === 'inside' ? state.overId : null;
  if (insideId !== prevOverInsideId) {
    setToggleDropActive(insideId);
    prevOverInsideId = insideId;
  }

  setDragSessionActive(true, getEditorRoot);
}

export function resetDragDomSync(): void {
  for (const id of prevDraggingIds) setDraggingClass(id, false);
  prevDraggingIds = [];
  setToggleDropActive(null);
  setDragSessionActive(false);
  prevOverInsideId = null;
}
