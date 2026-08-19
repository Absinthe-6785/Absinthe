/**
 * EditorChrome.tsx — Block chrome presentation (handles, shell classes)
 */
import React, { useLayoutEffect, useRef } from 'react';
import { BlockGripIcon } from './editorDragDrop';
import { shouldShowBlockChrome } from './editorReading';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import type { TurnIntoMenuState } from './editorTypes';
import { GRIP_DRAG_TITLE, GUTTER_RANGE_TITLE } from './features/block-editor/utils/editorDiscoverability';

export function blockShellClassName(
  isActive: boolean,
  selected: boolean,
  controlsVisible: boolean,
  extra?: string,
): string {
  return `be-block${isActive ? ' be-block-active' : ''}${selected ? ' be-block-selected' : ''}${controlsVisible ? ' be-controls-visible' : ''}${extra ? ` ${extra}` : ''}`;
}

export interface BlockGutterProps {
  blockId: string;
  readOnly: boolean;
  onPointerDown?: (blockId: string, e: React.PointerEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

/** Dedicated gutter column — drag strip is always pointer-hittable (UX-2B fix). */
export function BlockGutter({ blockId, readOnly, onPointerDown, children }: BlockGutterProps) {
  if (readOnly) return null;
  return (
    <div className="be-gutter" data-gutter-block-id={blockId}>
      <div
        className="be-gutter-strip"
        title={GUTTER_RANGE_TITLE}
        aria-label={GUTTER_RANGE_TITLE}
        onPointerDown={onPointerDown ? e => onPointerDown(blockId, e) : undefined}
      />
      {children}
    </div>
  );
}

export interface BlockHandlesProps {
  blockId: string;
  depth: number;
  readOnly: boolean;
  controlsVisible: boolean;
  onChromeEnter?: (id: string) => void;
  onChromeLeave?: () => void;
  onToggleControlsPin?: (id: string) => void;
  bindGripPointer: (id: string, e: React.PointerEvent, onClick: () => void) => void;
  onOpenTurnInto: (state: TurnIntoMenuState) => void;
}

/**
 * Keep the visible handle on the first visual line of its actual block.
 *
 * The gutter follows the full block wrapper, so centering the handle in the
 * gutter makes multiline blocks and headings appear to have a floating grip.
 * The block wrapper and its first editable visual element are the only
 * geometry sources used here; the handle is never used as a drop target.
 */
export function alignHandleToFirstVisualLine(handlesEl: HTMLElement): void {
  const blockEl = handlesEl.closest('.be-block') as HTMLElement | null;
  if (!blockEl) return;

  const blockRect = blockEl.getBoundingClientRect();
  const contentEl = Array.from(blockEl.children)
    .find(child => child.classList.contains('be-content')) as HTMLElement | undefined;
  const anchorEl = contentEl?.querySelector('.be-editable, .be-editable-static') as HTMLElement | null
    ?? contentEl?.firstElementChild as HTMLElement | null
    ?? contentEl
    ?? blockEl;
  const anchorRect = anchorEl.getBoundingClientRect();
  const lineHeight = anchorEl === blockEl || typeof window === 'undefined'
    ? Number.NaN
    : Number.parseFloat(window.getComputedStyle(anchorEl).lineHeight);
  const measuredHeight = anchorRect.height > 0 ? anchorRect.height : lineHeight;
  const firstLineHeight = Number.isFinite(lineHeight) && lineHeight > 0
    ? Math.min(measuredHeight, lineHeight)
    : Math.min(Math.max(measuredHeight, 0), 32);
  const anchorCenter = anchorRect.top + firstLineHeight / 2;
  const offset = Math.max(0, anchorCenter - blockRect.top);

  handlesEl.style.top = `${offset}px`;
  handlesEl.style.transform = 'translate(-50%, -50%)';
}

export function BlockHandles({
  blockId, depth, readOnly, controlsVisible,
  onChromeEnter, onChromeLeave, onToggleControlsPin,
  bindGripPointer, onOpenTurnInto,
}: BlockHandlesProps) {
  const handlesRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const handlesEl = handlesRef.current;
    // Hidden handles are not interactive. Defer geometry reads until the
    // block is hovered or pinned so virtualized scrolling stays layout-free.
    if (!handlesEl || !controlsVisible) return;
    const blockEl = handlesEl.closest('.be-block') as HTMLElement | null;
    if (!blockEl) return;

    const update = () => alignHandleToFirstVisualLine(handlesEl);
    update();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(blockEl);
    return () => observer.disconnect();
  }, [blockId, controlsVisible, depth]);

  if (!shouldShowBlockChrome(readOnly)) return null;

  void depth;

  return (
    <div
      ref={handlesRef}
      className="be-handles"
      onMouseEnter={() => onChromeEnter?.(blockId)}
      onMouseLeave={() => onChromeLeave?.()}
      style={{
        position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
      }}
    >
      <button
        type="button"
        className={`be-grip be-handle-btn${controlsVisible ? ' be-grip-pinned' : ''}`}
        onPointerDown={e => {
          e.stopPropagation();
          const gripEl = e.currentTarget as HTMLElement;
          bindGripPointer(blockId, e, () => {
            onToggleControlsPin?.(blockId);
            const rect = gripEl.getBoundingClientRect();
            onOpenTurnInto({ blockId, anchorY: rect.top, anchorX: rect.right + 2 });
          });
        }}
        title={GRIP_DRAG_TITLE}
        aria-label={GRIP_DRAG_TITLE}
      >
        <BlockGripIcon />
      </button>
    </div>
  );
}

export function EditorChromeStyles() {
  return <style>{EDITOR_CHROME_STYLES}</style>;
}
