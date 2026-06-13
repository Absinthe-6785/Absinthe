import React, { type CSSProperties, type ReactNode } from 'react';
import type { Block } from './blockUtils';
import type { BlockEditorColors, BlockRenderContext } from './editorTypes';
import { renderToggleChildren, renderToggleHeader, type ToggleNestedRenderer } from './toggleRender';
import { isToggleHeadingBlockType, toggleHeadingLevel } from './toggleBlockTypes';

export interface ToggleBlockProps {
  block: Block;
  colors: BlockEditorColors;
  ctx: BlockRenderContext;
  toggleOpen: boolean;
  depth: number;
  blockShellProps: Record<string, unknown>;
  blockShellStyle: CSSProperties;
  blockShellClass: string;
  gutterChrome: ReactNode;
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
  depth,
  blockShellProps,
  blockShellStyle,
  blockShellClass,
  gutterChrome,
  onChromeEnter,
  onChromeLeave,
  onSelect,
  renderNested,
}: ToggleBlockProps) {
  const isToggleHeading = isToggleHeadingBlockType(block.type);
  return (
    <div
      className={`be-toggle-wrap${!toggleOpen ? ' be-toggle-collapsed' : ''}${isToggleHeading ? ' be-toggle-heading-wrap' : ''}`}
      data-toggle-heading={isToggleHeading ? String(toggleHeadingLevel(block.type) ?? '') : undefined}
      style={{ '--be-toggle-depth': depth } as CSSProperties}
    >
      <div
        {...blockShellProps}
        style={blockShellStyle}
        className={`${blockShellClass} be-toggle-header-block${isToggleHeading ? ' be-toggle-heading-header' : ''}`}
        onMouseEnter={onChromeEnter}
        onMouseLeave={onChromeLeave}
      >
        {gutterChrome}
        <div className="be-content" onMouseDown={onSelect}>
          {renderToggleHeader(block, c, ctx)}
        </div>
      </div>
      {toggleOpen && renderToggleChildren(block, ctx, renderNested)}
    </div>
  );
}
