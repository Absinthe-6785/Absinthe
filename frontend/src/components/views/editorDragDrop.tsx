/**
 * editorDragDrop.tsx — Block editor drag-and-drop (extracted from BlockEditor)
 */
import React, { useState, useRef, useCallback } from 'react';
import { flattenBlockIds, type Block } from './blockUtils';
import { applyHierarchyDragDrop } from './dragHierarchy';
import { applyMultiBlockDragDrop } from './multiBlockDrag';
import { minimalDragIds } from './dragSelection';
import { renumberNumberedListsDeep } from './listBlocks';

const DRAG_REJECT_MS = 420;

export interface DragState {
  draggingIds: string[];
  overId: string | null;
  overPos: 'before' | 'after' | 'inside' | null;
}

export interface UseDragDropResult {
  dragState: DragState | null;
  bindGripPointer: (id: string, e: React.PointerEvent, onClick?: () => void) => void;
  getDragProps: (id: string) => {
    onPointerEnter: (e: React.PointerEvent) => void;
    'data-drag-id': string;
  };
}

export interface UseDragDropOptions {
  getSelectedIds?: () => string[];
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
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  dragStateRef.current = dragState;
  const getBlocksRef = useRef(getBlocks);
  getBlocksRef.current = getBlocks;
  const getSelectedIdsRef = useRef(options.getSelectedIds);
  getSelectedIdsRef.current = options.getSelectedIds;

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
    const draggingIds = resolveDraggingIds(id);

    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        setDragState({ draggingIds, overId: null, overPos: null });
      }

      const primaryId = draggingIds[0];
      const els = document.elementsFromPoint(ev.clientX, ev.clientY);
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
        if (blockType === 'toggle' && (collapsedToggle || ev.clientY > rect.top + rect.height * 0.35)) {
          overPos = 'inside';
        } else {
          overPos = ev.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        }
        setDragState(s => s?.draggingIds[0] === primaryId ? { ...s, overId, overPos } : s);
        return;
      }

      const toggleDropEl = els.find(
        el => el.classList.contains('be-toggle-drop') &&
              !draggingIds.includes(el.getAttribute('data-toggle-id') ?? ''),
      ) as HTMLElement | undefined;

      if (toggleDropEl) {
        const toggleId = toggleDropEl.getAttribute('data-toggle-id') ?? '';
        setDragState(s => s?.draggingIds[0] === primaryId ? { ...s, overId: toggleId, overPos: 'inside' } : s);
        return;
      }

      setDragState(s => s?.draggingIds[0] === primaryId ? { ...s, overId: null, overPos: null } : s);
    };

    const onUp = () => {
      if (!dragging) {
        onClick?.();
      } else {
        const st = dragStateRef.current;
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
        setDragState(null);
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [onReorder, resolveDraggingIds]);

  const getDragProps = useCallback((id: string) => ({
    onPointerEnter: (_e: React.PointerEvent) => {
      // handled via pointermove on window during active drag
    },
    'data-drag-id': id,
  }), []);

  return { dragState, bindGripPointer, getDragProps };
}
