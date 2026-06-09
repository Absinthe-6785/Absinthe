/**
 * editorDragDrop.tsx — Block editor drag-and-drop (extracted from BlockEditor)
 */
import React, { useRef, useCallback } from 'react';
import { flattenBlockIds, type Block } from './blockUtils';
import { applyHierarchyDragDrop } from './dragHierarchy';
import { applyMultiBlockDragDrop } from './multiBlockDrag';
import { minimalDragIds } from './dragSelection';
import { renumberNumberedListsDeep } from './listBlocks';
import { applyDragAutoscroll } from './dragAutoscroll';
import { isDragOverUnchanged } from './dragOverState';
import {
  getDragStateSnapshot,
  setDragStateStore,
  updateDragStateOver,
} from './features/block-editor/performance/dragStateStore';
import { syncDragDom } from './features/block-editor/performance/dragDomSync';

const DRAG_REJECT_MS = 420;

export interface DragState {
  draggingIds: string[];
  overId: string | null;
  overPos: 'before' | 'after' | 'inside' | null;
}

export interface UseDragDropResult {
  bindGripPointer: (id: string, e: React.PointerEvent, onClick?: () => void) => void;
  getDragProps: (id: string) => {
    onPointerEnter: (e: React.PointerEvent) => void;
    'data-drag-id': string;
  };
}

export type DragOverResolver = (
  clientX: number,
  clientY: number,
  draggingIds: string[],
) => { overId: string; overPos: 'before' | 'after' | 'inside' } | null;

export interface UseDragDropOptions {
  getSelectedIds?: () => string[];
  /** Primary note scroll container (e.g. .editor-drop-zone). No global document scroll. */
  getScrollContainer?: () => HTMLElement | null;
  /** Editor root for imperative drag chrome (isolation from React tree). */
  getEditorRoot?: () => HTMLElement | null;
  /** Custom hit-test (virtual row metrics); defaults to DOM elementsFromPoint. */
  resolveDragOver?: DragOverResolver;
}

const DRAG_THRESHOLD_PX = 6;

/** Apply drag mutation + deep numbered-list renumber (UX-4B.1). */
export function commitDragDrop(
  root: Block[],
  draggingIds: string[],
  overId: string,
  overPos: 'before' | 'after' | 'inside',
): Block[] | null {
  const next = draggingIds.length > 1
    ? applyMultiBlockDragDrop(root, draggingIds, overId, overPos)
    : applyHierarchyDragDrop(root, draggingIds[0], overId, overPos);
  return next ? renumberNumberedListsDeep(next) : null;
}

function pulseDragReject(ids: string[]) {
  if (typeof document === 'undefined') return;
  for (const id of ids) {
    const grip = document.querySelector(`[data-drag-id="${id}"] .be-grip`);
    grip?.classList.add('be-drag-rejected');
  }
  window.setTimeout(() => {
    for (const id of ids) {
      const grip = document.querySelector(`[data-drag-id="${id}"] .be-grip`);
      grip?.classList.remove('be-drag-rejected');
    }
  }, DRAG_REJECT_MS);
}

export function resolveDragOverFromPoint(
  clientX: number,
  clientY: number,
  draggingIds: string[],
): { overId: string; overPos: 'before' | 'after' | 'inside' } | null {
  const els = document.elementsFromPoint(clientX, clientY);
  const blockEl = els.find(
    el => el.classList.contains('be-block') &&
          !draggingIds.includes(el.getAttribute('data-drag-id') ?? ''),
  ) as HTMLElement | undefined;

  if (blockEl) {
    const overId = blockEl.getAttribute('data-drag-id') ?? '';
    const blockType = blockEl.getAttribute('data-block-type');
    const rect = blockEl.getBoundingClientRect();
    let overPos: 'before' | 'after' | 'inside';
    const collapsedToggle = blockEl.getAttribute('data-toggle-collapsed') === 'true';
    if (blockType === 'toggle' && (collapsedToggle || clientY > rect.top + rect.height * 0.35)) {
      overPos = 'inside';
    } else {
      overPos = clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    }
    return { overId, overPos };
  }

  const toggleDropEl = els.find(
    el => el.classList.contains('be-toggle-drop') &&
          !draggingIds.includes(el.getAttribute('data-toggle-id') ?? ''),
  ) as HTMLElement | undefined;

  if (toggleDropEl) {
    return {
      overId: toggleDropEl.getAttribute('data-toggle-id') ?? '',
      overPos: 'inside',
    };
  }

  return null;
}

/** Indent-aware drop target line (Notion-style). */
export function DropInsertIndicator({
  position,
  indentLeft,
  accent,
}: {
  position: 'before' | 'after';
  indentLeft: number;
  accent: string;
}) {
  const edge = position === 'before' ? { top: -1 } : { bottom: -1 };
  const dotEdge = position === 'before' ? { top: -5 } : { bottom: -5 };
  return (
    <>
      <div
        className="be-drop-line"
        style={{
          position: 'absolute',
          left: indentLeft,
          right: 0,
          height: 2,
          background: accent,
          borderRadius: 1,
          zIndex: 10,
          pointerEvents: 'none',
          boxShadow: `0 0 8px ${accent}66`,
          ...edge,
        }}
      />
      <div
        className="be-drop-dot"
        style={{
          position: 'absolute',
          left: Math.max(0, indentLeft - 4),
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: accent,
          zIndex: 11,
          pointerEvents: 'none',
          boxShadow: `0 0 6px ${accent}88`,
          ...dotEdge,
        }}
      />
    </>
  );
}

/** Notion-style 6-dot drag grip */
export function BlockGripIcon() {
  return (
    <span className="be-grip-icon" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="be-grip-dot" />
      ))}
    </span>
  );
}

export function useDragDrop(
  getBlocks: () => Block[],
  onReorder: (newBlocks: Block[]) => void,
  options: UseDragDropOptions = {},
): UseDragDropResult {
  const getBlocksRef = useRef(getBlocks);
  getBlocksRef.current = getBlocks;
  const getSelectedIdsRef = useRef(options.getSelectedIds);
  getSelectedIdsRef.current = options.getSelectedIds;
  const getScrollContainerRef = useRef(options.getScrollContainer);
  getScrollContainerRef.current = options.getScrollContainer;
  const getEditorRootRef = useRef(options.getEditorRoot);
  getEditorRootRef.current = options.getEditorRoot;
  const resolveDragOverRef = useRef(options.resolveDragOver);
  resolveDragOverRef.current = options.resolveDragOver;

  const publishDragState = useCallback((next: DragState | null) => {
    setDragStateStore(next);
    syncDragDom(next, () => getEditorRootRef.current?.() ?? null);
  }, []);

  const resolveDraggingIds = useCallback((id: string): string[] => {
    const selected = getSelectedIdsRef.current?.() ?? [];
    if (selected.includes(id) && selected.length > 1) {
      return minimalDragIds(getBlocksRef.current(), selected);
    }
    return [id];
  }, []);

  const bindGripPointer = useCallback((id: string, e: React.PointerEvent, onClick?: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let cleanedUp = false;
    const draggingIds = resolveDraggingIds(id);
    const primaryId = draggingIds[0];
    const captureEl = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;

    const updateOver = (overId: string | null, overPos: DragState['overPos']) => {
      const current = getDragStateSnapshot();
      if (!current || current.draggingIds[0] !== primaryId) return;
      if (isDragOverUnchanged(current, overId, overPos)) return;
      updateDragStateOver(overId, overPos);
      syncDragDom(getDragStateSnapshot(), () => getEditorRootRef.current?.() ?? null);
    };

    const beginDragging = () => {
      dragging = true;
      try {
        captureEl.setPointerCapture(pointerId);
      } catch {
        // happy-dom / unsupported capture — window listeners still apply
      }
      publishDragState({ draggingIds, overId: null, overPos: null });
    };

    const cleanup = (shouldCommit: boolean) => {
      if (cleanedUp) return;
      cleanedUp = true;

      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('keydown', onKeyDown);
      captureEl.removeEventListener('lostpointercapture', onLostCapture);

      try {
        if (captureEl.hasPointerCapture?.(pointerId)) {
          captureEl.releasePointerCapture(pointerId);
        }
      } catch {
        // ignore
      }

      if (shouldCommit && dragging) {
        const st = getDragStateSnapshot();
        if (st?.overId && st.overPos && st.draggingIds.length) {
          const next = commitDragDrop(
            getBlocksRef.current(),
            st.draggingIds,
            st.overId,
            st.overPos,
          );
          if (next) onReorder(next);
          else pulseDragReject(st.draggingIds);
        }
      }

      publishDragState(null);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;

      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
        beginDragging();
      }

      const scrollContainer = getScrollContainerRef.current?.();
      if (scrollContainer) {
        applyDragAutoscroll(scrollContainer, ev.clientY);
      }

      const resolve = resolveDragOverRef.current ?? resolveDragOverFromPoint;
      const hit = resolve(ev.clientX, ev.clientY, draggingIds);
      if (hit) {
        updateOver(hit.overId, hit.overPos);
      } else {
        updateOver(null, null);
      }
    };

    const onPointerEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const commit = ev.type === 'pointerup';
      if (!dragging) {
        if (commit) onClick?.();
        cleanup(false);
        return;
      }
      cleanup(commit);
    };

    const onLostCapture = () => {
      cleanup(false);
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !dragging) return;
      ev.preventDefault();
      cleanup(false);
    };

    captureEl.addEventListener('lostpointercapture', onLostCapture);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    window.addEventListener('keydown', onKeyDown);
  }, [onReorder, publishDragState, resolveDraggingIds]);

  const getDragProps = useCallback((id: string) => ({
    onPointerEnter: (_e: React.PointerEvent) => {
      // handled via pointermove on window during active drag
    },
    'data-drag-id': id,
  }), []);

  return { bindGripPointer, getDragProps };
}
