import React, { type CSSProperties, type ReactNode, useCallback } from 'react';
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
  onGutterPointerDown?: (id: string, e: React.PointerEvent<HTMLDivElement>) => void;
  readOnly?: boolean;
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
  onGutterPointerDown,
  readOnly = false,
  renderNested,
}: ToggleBlockProps) {
  const isToggleHeading = isToggleHeadingBlockType(block.type);

  const handleHeaderShellPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !onGutterPointerDown || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('.be-handles, .be-block-handle-menu, .be-grip, button, input, label, a, table')) return;
    if (t.closest('.be-gutter-strip')) return;
    if (t.closest('.be-editable[contenteditable="true"]')) return;
    if (t.closest('.be-editable-static') && !e.shiftKey) return;
    const shell = e.currentTarget;
    const rect = shell.getBoundingClientRect();
    const inLeftZone = e.clientX - rect.left < 56;
    if (!inLeftZone && !e.shiftKey) return;
    onGutterPointerDown(block.id, e);
  }, [readOnly, block.id, onGutterPointerDown]);

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
        onPointerDown={handleHeaderShellPointerDown}
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
