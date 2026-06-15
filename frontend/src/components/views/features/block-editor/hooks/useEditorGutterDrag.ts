import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Block } from '../../../blockUtils';
import {
  beginGutterSelection,
  hitTestBlockIdFromPoint,
  isGutterDragStart,
} from '../../../blockGutterSelection';

export interface UseEditorGutterDragOptions {
  readOnly: boolean;
  anchorBlockId: string | null;
  applyGutterRange: (anchorId: string, hoverId: string) => void;
  editorRootRef: RefObject<HTMLDivElement | null>;
}

export interface UseEditorGutterDragResult {
  handleGutterPointerDown: (blockId: string, e: React.PointerEvent<HTMLDivElement>) => void;
  isGutterDragging: boolean;
  gutterDragCleanupRef: React.MutableRefObject<(() => void) | null>;
}

/** True when pointer is in the block's left drag-selection zone (gutter + margin). */
export function isBlockLeftDragZone(
  shell: HTMLElement | null,
  clientX: number,
): boolean {
  if (!shell) return false;
  const rect = shell.getBoundingClientRect();
  return clientX - rect.left < 56;
}

export function useEditorGutterDrag({
  readOnly,
  anchorBlockId,
  applyGutterRange,
  editorRootRef,
}: UseEditorGutterDragOptions): UseEditorGutterDragResult {
  const gutterDragCleanupRef = useRef<(() => void) | null>(null);
  const [isGutterDragging, setIsGutterDragging] = useState(false);

  useEffect(() => () => {
    gutterDragCleanupRef.current?.();
  }, []);

  const handleGutterPointerDown = useCallback((blockId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (!isGutterDragStart(e.target) && !isBlockLeftDragZone(
      (e.currentTarget as HTMLElement).closest('[data-drag-id]') as HTMLElement | null,
      e.clientX,
    )) {
      return;
    }
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();
    window.getSelection()?.removeAllRanges();

    gutterDragCleanupRef.current?.();

    const root = editorRootRef.current;
    root?.setPointerCapture(e.pointerId);
    const anchorId = e.shiftKey && anchorBlockId ? anchorBlockId : blockId;
    beginGutterSelection(anchorId, e.pointerId);
    setIsGutterDragging(true);

    const applyHover = (hoverId: string) => {
      applyGutterRange(anchorId, hoverId);
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
  }, [readOnly, anchorBlockId, applyGutterRange, editorRootRef]);

  return {
    handleGutterPointerDown,
    isGutterDragging,
    gutterDragCleanupRef,
  };
}
