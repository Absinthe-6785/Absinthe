/**
 * EditorChrome.tsx — Block chrome presentation (handles, shell classes)
 */
import React from 'react';
import { BlockGripIcon } from './editorDragDrop';
import { shouldShowBlockChrome } from './editorReading';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import type { TurnIntoMenuState } from './editorTypes';

export function blockShellClassName(
  isActive: boolean,
  selected: boolean,
  controlsVisible: boolean,
  extra?: string,
): string {
  return `be-block${isActive ? ' be-block-active' : ''}${selected ? ' be-block-selected' : ''}${controlsVisible ? ' be-controls-visible' : ''}${extra ? ` ${extra}` : ''}`;
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

export interface BlockGutterProps {
  blockId: string;
  readOnly: boolean;
  onPointerDown?: (blockId: string, e: React.PointerEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

export function BlockGutter({ blockId, readOnly, onPointerDown, children }: BlockGutterProps) {
  if (readOnly) return null;
  return (
    <div
      className="be-gutter"
      data-gutter-block-id={blockId}
      onPointerDown={onPointerDown ? e => onPointerDown(blockId, e) : undefined}
    >
      {children}
    </div>
  );
}

export function BlockHandles({
  blockId, depth, readOnly, controlsVisible,
  onChromeEnter, onChromeLeave, onToggleControlsPin,
  bindGripPointer, onOpenTurnInto,
}: BlockHandlesProps) {
  if (!shouldShowBlockChrome(readOnly)) return null;

  void depth;

  return (
    <div
      className="be-handles"
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onMouseEnter={() => onChromeEnter?.(blockId)}
      onMouseLeave={() => onChromeLeave?.()}
      style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
      }}
    >
      <button
        type="button"
        className={`be-grip be-handle-btn${controlsVisible ? ' be-grip-pinned' : ''}`}
        onPointerDown={e => {
          const gripEl = e.currentTarget as HTMLElement;
          bindGripPointer(blockId, e, () => {
            onToggleControlsPin?.(blockId);
            const rect = gripEl.getBoundingClientRect();
            onOpenTurnInto({ blockId, anchorY: rect.top, anchorX: rect.right + 2 });
          });
        }}
        title="드래그: 이동 · 클릭: 메뉴"
      >
        <BlockGripIcon />
      </button>
    </div>
  );
}

export function EditorChromeStyles() {
  return <style>{EDITOR_CHROME_STYLES}</style>;
}
