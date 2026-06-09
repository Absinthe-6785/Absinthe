/**
 * DragOverlay — drop indicators and preview chrome isolated from the block tree.
 */
import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { findBlockById, type Block } from '../../../blockUtils';
import { DropInsertIndicator } from '../../../editorDragDrop';
import type { BlockEditorColors } from '../../../editorTypes';
import { useDragStateSnapshot } from './useDragStateSnapshot';

export interface DragOverlayProps {
  colors: BlockEditorColors;
  getBlocks: () => Block[];
  getEditorRoot: () => HTMLElement | null;
}

interface OverlayFrame {
  top: number;
  left: number;
  width: number;
  height: number;
  indentLeft: number;
}

function measureOverlayFrame(
  overId: string,
  getEditorRoot: () => HTMLElement | null,
): OverlayFrame | null {
  const el = document.querySelector(`[data-drag-id="${overId}"]`) as HTMLElement | null;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const marginLeft = parseFloat(getComputedStyle(el).marginLeft) || 0;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    indentLeft: marginLeft,
  };
}

function InsideIndicator({ frame, accent }: { frame: OverlayFrame; accent: string }) {
  return (
    <div
      className="be-drop-inside be-drag-overlay-inside"
      style={{
        position: 'fixed',
        top: frame.top + 2,
        left: frame.left + 2,
        width: Math.max(0, frame.width - 4),
        height: Math.max(0, frame.height - 4),
        borderRadius: 8,
        zIndex: 10000,
        border: `2px dashed ${accent}`,
        pointerEvents: 'none',
        background: `${accent}14`,
      }}
    />
  );
}

function LineIndicator({
  frame,
  position,
  accent,
}: {
  frame: OverlayFrame;
  position: 'before' | 'after';
  accent: string;
}) {
  const y = position === 'before' ? frame.top - 1 : frame.top + frame.height - 1;
  return (
    <div
      style={{
        position: 'fixed',
        top: y,
        left: frame.left + frame.indentLeft,
        width: Math.max(0, frame.width - frame.indentLeft),
        height: 0,
        zIndex: 10000,
        pointerEvents: 'none',
      }}
    >
      <DropInsertIndicator position={position} indentLeft={0} accent={accent} />
    </div>
  );
}

export function DragOverlay({ colors, getBlocks, getEditorRoot }: DragOverlayProps) {
  const dragState = useDragStateSnapshot();
  const [frame, setFrame] = useState<OverlayFrame | null>(null);

  useLayoutEffect(() => {
    if (!dragState?.overId || !dragState.overPos) {
      setFrame(null);
      return;
    }
    const next = measureOverlayFrame(dragState.overId, getEditorRoot);
    setFrame(next);
  }, [dragState?.overId, dragState?.overPos, getEditorRoot]);

  if (!dragState?.overId || !dragState.overPos || !frame) return null;

  const block = findBlockById(getBlocks(), dragState.overId) as Block | null;
  const isDragging = dragState.draggingIds.includes(dragState.overId);
  if (isDragging) return null;

  const host = typeof document !== 'undefined' ? document.body : null;
  if (!host) return null;

  const accent = colors.accent;

  return createPortal(
    <>
      {dragState.overPos === 'inside' && block?.type === 'toggle' && (
        <InsideIndicator frame={frame} accent={accent} />
      )}
      {dragState.overPos === 'before' && (
        <LineIndicator frame={frame} position="before" accent={accent} />
      )}
      {dragState.overPos === 'after' && (
        <LineIndicator frame={frame} position="after" accent={accent} />
      )}
    </>,
    host,
  );
}
