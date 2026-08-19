/**
 * EditorChrome.tsx — Block chrome presentation (handles, shell classes)
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

export function isHandleGeometryActive(
  controlsVisible: boolean,
  blockEl: HTMLElement,
  pointerGeometryActive: boolean,
): boolean {
  if (controlsVisible || pointerGeometryActive) return true;
  if (blockEl.classList.contains('be-block-active')) return true;
  if (blockEl.classList.contains('be-dragging')) return true;
  if (!blockEl.classList.contains('be-block-selected')) return false;
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
}

export function BlockHandles({
  blockId, depth, readOnly, controlsVisible,
  onChromeEnter, onChromeLeave, onToggleControlsPin,
  bindGripPointer, onOpenTurnInto,
}: BlockHandlesProps) {
  const handlesRef = useRef<HTMLDivElement | null>(null);
  const geometryObserverRef = useRef<ResizeObserver | null>(null);
  const geometryBlockRef = useRef<HTMLElement | null>(null);
  const geometryHandlesRef = useRef<HTMLElement | null>(null);
  const geometryKeyRef = useRef('');
  const pointerIdRef = useRef<number | null>(null);
  const [pointerGeometryActive, setPointerGeometryActive] = useState(false);

  const disconnectGeometryObserver = useCallback(() => {
    geometryObserverRef.current?.disconnect();
    geometryObserverRef.current = null;
    geometryBlockRef.current = null;
    geometryHandlesRef.current = null;
    geometryKeyRef.current = '';
  }, []);

  useEffect(() => {
    if (!pointerGeometryActive || typeof window === 'undefined') return;
    const stopPointerGeometry = (event: PointerEvent) => {
      if (pointerIdRef.current !== event.pointerId) return;
      pointerIdRef.current = null;
      setPointerGeometryActive(false);
    };
    window.addEventListener('pointerup', stopPointerGeometry);
    window.addEventListener('pointercancel', stopPointerGeometry);
    return () => {
      window.removeEventListener('pointerup', stopPointerGeometry);
      window.removeEventListener('pointercancel', stopPointerGeometry);
    };
  }, [pointerGeometryActive]);

  useLayoutEffect(() => {
    const handlesEl = handlesRef.current;
    if (!handlesEl) {
      disconnectGeometryObserver();
      return;
    }
    const blockEl = handlesEl.closest('.be-block') as HTMLElement | null;
    const geometryActive = blockEl !== null
      && isHandleGeometryActive(controlsVisible, blockEl, pointerGeometryActive);
    if (!blockEl || !geometryActive) {
      disconnectGeometryObserver();
      return;
    }

    const geometryKey = `${blockId}:${depth}`;
    if (geometryBlockRef.current === blockEl
      && geometryHandlesRef.current === handlesEl
      && geometryKeyRef.current === geometryKey) {
      return;
    }

    disconnectGeometryObserver();

    const update = () => alignHandleToFirstVisualLine(handlesEl);
    update();

    geometryBlockRef.current = blockEl;
    geometryHandlesRef.current = handlesEl;
    geometryKeyRef.current = geometryKey;

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(blockEl);
    geometryObserverRef.current = observer;
  });

  useLayoutEffect(() => () => disconnectGeometryObserver(), [disconnectGeometryObserver]);

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
          pointerIdRef.current = e.pointerId;
          setPointerGeometryActive(true);
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
