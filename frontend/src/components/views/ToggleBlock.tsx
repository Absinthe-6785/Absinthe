import React, { type ReactNode, type CSSProperties } from 'react';
import type { Block } from './blockUtils';
import type { BlockEditorColors, BlockRenderContext } from './editorTypes';
import { renderToggleChildren, renderToggleHeader, type ToggleNestedRenderer } from './toggleRender';

export interface ToggleBlockProps {
  block: Block;
  colors: BlockEditorColors;
  ctx: BlockRenderContext;
  toggleOpen: boolean;
  toggleDropActive: boolean;
  depth: number;
  blockShellProps: Record<string, unknown>;
  blockShellStyle: CSSProperties;
  blockShellClass: string;
  dropIndicators: ReactNode;
  handles: ReactNode;
  onChromeEnter?: () => void;
  onChromeLeave?: () => void;
  onSelect: (e: React.MouseEvent) => void;
  renderNested: ToggleNestedRenderer;
}

export function ToggleBlock({
  block,
  colors: c,
  ctx,
  toggleOpen,
  toggleDropActive,
  depth,
  blockShellProps,
  blockShellStyle,
  blockShellClass,
  dropIndicators,
  handles,
  onChromeEnter,
  onChromeLeave,
  onSelect,
  renderNested,
}: ToggleBlockProps) {
  return (
    <div
      className={`be-toggle-wrap${!toggleOpen ? ' be-toggle-collapsed' : ''}${toggleDropActive ? ' be-toggle-drop-active' : ''}`}
      style={{ '--be-toggle-depth': depth } as CSSProperties}
    >
      <div
        {...blockShellProps}
        style={blockShellStyle}
        className={`${blockShellClass} be-toggle-header-block`}
        onMouseEnter={onChromeEnter}
        onMouseLeave={onChromeLeave}
        onMouseDown={onSelect}
      >
        {dropIndicators}
        {handles}
        {renderToggleHeader(block, c, ctx)}
      </div>
      {toggleOpen && renderToggleChildren(block, ctx, renderNested, toggleDropActive)}
    </div>
  );
}
