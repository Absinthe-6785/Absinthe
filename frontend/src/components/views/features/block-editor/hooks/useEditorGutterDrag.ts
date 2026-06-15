import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Block } from '../../../blockUtils';
import {
  beginGutterSelection,
  hitTestBlockIdFromPoint,
  isGutterDragStart,
  updateGutterSelection,
} from '../../../blockGutterSelection';

export interface UseEditorGutterDragOptions {
  readOnly: boolean;
  depth: number;
  getRootBlocks: () => Block[];
  setSelectedBlockIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setAnchorBlockId: React.Dispatch<React.SetStateAction<string | null>>;
  onActiveBlockChange: (id: string | null) => void;
  editorRootRef: RefObject<HTMLDivElement | null>;
}

export interface UseEditorGutterDragResult {
  handleGutterPointerDown: (blockId: string, e: React.PointerEvent<HTMLDivElement>) => void;
  isGutterDragging: boolean;
  gutterDragCleanupRef: React.MutableRefObject<(() => void) | null>;
}

export function useEditorGutterDrag({
  readOnly,
  depth,
  getRootBlocks,
  setSelectedBlockIds,
  setAnchorBlockId,
  onActiveBlockChange,
  editorRootRef,
}: UseEditorGutterDragOptions): UseEditorGutterDragResult {
  const gutterDragCleanupRef = useRef<(() => void) | null>(null);
  const [isGutterDragging, setIsGutterDragging] = useState(false);

  useEffect(() => () => {
    gutterDragCleanupRef.current?.();
  }, []);

  const handleGutterPointerDown = useCallback((blockId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (!isGutterDragStart(e.target)) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();
    window.getSelection()?.removeAllRanges();

    gutterDragCleanupRef.current?.();

    const root = editorRootRef.current;
    root?.setPointerCapture(e.pointerId);
    beginGutterSelection(blockId, e.pointerId);
    setIsGutterDragging(true);

    const anchorId = blockId;
    const applyHover = (hoverId: string) => {
      const selected = updateGutterSelection(getRootBlocks(), anchorId, hoverId);
      setSelectedBlockIds(selected);
      setAnchorBlockId(anchorId);
      onActiveBlockChange(hoverId);
    };

    applyHover(blockId);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const hoverId = hitTestBlockIdFromPoint(ev.clientX, ev.clientY, root);
      if (hoverId) applyHover(hoverId);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      root?.releasePointerCapture(ev.pointerId);
      setIsGutterDragging(false);
      cleanup();
      gutterDragCleanupRef.current = null;
    };
    gutterDragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [readOnly, getRootBlocks, onActiveBlockChange]);

  return {
    handleGutterPointerDown,
    isGutterDragging,
    gutterDragCleanupRef,
  };
}
