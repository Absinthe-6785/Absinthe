/**
 * DragOverlay — drop indicators and drag ghosts isolated from the block tree.
 * Virtual-safe: positions from row metrics when source DOM is unmounted.
 */
import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { findBlockById, type Block } from '../../../blockUtils';
import { isToggleBlockType } from '../../../toggleBlockTypes';
import type { BlockEditorColors } from '../../../editorTypes';
import {
  resolveDropHighlightGeometry,
  resolveOverlayFrame,
  type OverlayFrame,
  type RowMetricsOptions,
} from './rowMetrics';
import { useDragStateSnapshot } from './useDragStateSnapshot';

export interface DragOverlayProps {
  colors: BlockEditorColors;
  getBlocks: () => Block[];
  getEditorRoot: () => HTMLElement | null;
  getRowMetricsOptions?: () => RowMetricsOptions | null;
}

function isBlockDomMounted(blockId: string): boolean {
  return !!document.querySelector(`[data-drag-id="${blockId}"]`);
}

function InsideIndicator({ frame, accent }: { frame: OverlayFrame; accent: string }) {
  return (
    <div
      className="be-drop-inside be-drag-overlay-inside"
      style={{
        position: 'fixed',
        top: frame.top + 2,
        left: frame.left + frame.indentLeft + 2,
        width: Math.max(0, frame.width - frame.indentLeft - 4),
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

function DropHighlight({
  overId,
  frame,
  position,
  accent,
  indicatorY,
}: {
  overId: string;
  frame: OverlayFrame;
  position: 'before' | 'after';
  accent: string;
  indicatorY?: number | null;
}) {
  const geometry = resolveDropHighlightGeometry(frame, position, indicatorY);
  return (
    <div
      className={`be-drop-highlight be-drop-highlight-${position}`}
      data-drop-highlight="true"
      data-drop-highlight-position={position}
      data-drop-target-id={overId}
      style={{
        position: 'fixed',
        top: geometry.top,
        left: geometry.left,
        width: geometry.width,
        height: geometry.height,
        borderRadius: 6,
        background: `${accent}14`,
        boxShadow: `0 0 0 1px ${accent}20`,
        transition: 'top 120ms ease, left 120ms ease, width 120ms ease, opacity 120ms ease',
        opacity: 0.92,
        zIndex: 10000,
        pointerEvents: 'none',
      }}
    />
  );
}

function DragGhost({ frame }: { frame: OverlayFrame }) {
  return (
    <div
      className="be-drag-ghost be-block be-dragging"
      data-drag-ghost="true"
      style={{
        position: 'fixed',
        top: frame.top,
        left: frame.left,
        width: frame.width,
        height: frame.height,
        opacity: 0.4,
        pointerEvents: 'none',
        zIndex: 9999,
        boxSizing: 'border-box',
      }}
    />
  );
}

export function DragOverlay({
  colors,
  getBlocks,
  getEditorRoot,
  getRowMetricsOptions,
}: DragOverlayProps) {
  const dragState = useDragStateSnapshot();
  const [dropFrame, setDropFrame] = useState<OverlayFrame | null>(null);
  const [ghostFrames, setGhostFrames] = useState<OverlayFrame[]>([]);

  useLayoutEffect(() => {
    if (!dragState) {
      setDropFrame(null);
      setGhostFrames([]);
      return;
    }

    const metricsOpts = getRowMetricsOptions?.() ?? {
      getEditorRoot,
      getRootBlockIds: () => getBlocks().map(b => b.id),
      getBlocks,
    };

    if (dragState.overId && dragState.overPos) {
      const frame = resolveOverlayFrame(dragState.overId, metricsOpts);
      setDropFrame(frame);
    } else {
      setDropFrame(null);
    }

    const ghosts: OverlayFrame[] = [];
    for (const id of dragState.draggingIds) {
      if (isBlockDomMounted(id)) continue;
      const frame = resolveOverlayFrame(id, metricsOpts);
      if (frame) ghosts.push(frame);
    }
    setGhostFrames(ghosts);
  }, [dragState, getBlocks, getEditorRoot, getRowMetricsOptions]);

  const host = typeof document !== 'undefined' ? document.body : null;
  if (!host || !dragState) return null;

  const accent = colors.accent;
  const overBlock = dragState.overId
    ? findBlockById(getBlocks(), dragState.overId) as Block | null
    : null;
  const showDrop = dropFrame
    && dragState.overId
    && dragState.overPos
    && !dragState.draggingIds.includes(dragState.overId);

  return createPortal(
    <>
      {ghostFrames.map((frame, i) => (
        <DragGhost key={`ghost-${i}`} frame={frame} />
      ))}
      {showDrop && dragState.overPos === 'inside' && overBlock != null && isToggleBlockType(overBlock.type) && (
        <InsideIndicator frame={dropFrame} accent={accent} />
      )}
      {showDrop && dragState.overPos === 'before' && dragState.overId && (
        <DropHighlight overId={dragState.overId} frame={dropFrame} position="before" accent={accent} indicatorY={dragState.indicatorY} />
      )}
      {showDrop && dragState.overPos === 'after' && dragState.overId && (
        <DropHighlight overId={dragState.overId} frame={dropFrame} position="after" accent={accent} indicatorY={dragState.indicatorY} />
      )}
    </>,
    host,
  );
}
