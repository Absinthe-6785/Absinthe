import { useCallback } from 'react';
import * as React from 'react';
import {
  type Block,
  makeBlock,
  updateBlockById,
  insertBlockAfter,
  findBlockById,
} from '../../../blockUtils';
import {
  applyToggleChildMergeIntoHeader,
  applyToggleHeaderEnter,
} from '../../../toggleNesting';
import { appendToggleChildParagraph } from '../../../toggleFooterInsertion';
import { getFocusHandler } from '../features/selection';
import type { ToggleNestedRenderer } from '../../../toggleRender';
import type { BlockEditorInnerProps } from '../types/blockEditorTypes';

export interface UseEditorToggleOptions {
  getBlocks: () => Block[];
  getRootBlocks: () => Block[];
  onChange: (blocks: Block[]) => void;
  onRootChange: (blocks: Block[]) => void;
  NestedEditor: React.ComponentType<BlockEditorInnerProps>;
  colors: BlockEditorInnerProps['colors'];
  readOnly: boolean;
  searchQuery: string;
  depth: number;
  wikiTargets: string[];
  onWikiNavigate?: (title: string) => void;
  onActiveBlockChange?: (id: string | null) => void;
  searchScope: BlockEditorInnerProps['searchScope'];
  searchMatchIndex: number;
}

export interface UseEditorToggleResult {
  handleToggleAddChild: (toggleBlockId: string) => void;
  handleToggleEnter: (toggleBlockId: string, before: string, after: string) => void;
  renderToggleNested: ToggleNestedRenderer;
}

export function useEditorToggle({
  getBlocks,
  getRootBlocks,
  onChange,
  onRootChange,
  NestedEditor,
  colors,
  readOnly,
  searchQuery,
  depth,
  wikiTargets,
  onWikiNavigate,
  onActiveBlockChange,
  searchScope,
  searchMatchIndex,
}: UseEditorToggleOptions): UseEditorToggleResult {
  const handleToggleAddChild = useCallback((toggleBlockId: string) => {
    const result = appendToggleChildParagraph(getBlocks(), toggleBlockId);
    if (!result) return;
    onChange(result.blocks);
    requestAnimationFrame(() => {
      const handler = getFocusHandler(result.focusBlockId);
      if (handler) handler({ blockId: result.focusBlockId, offset: 'start' });
    });
  }, [getBlocks, onChange]);

  const handleToggleEnter = useCallback((toggleBlockId: string, before: string, after: string) => {
    const toggle = findBlockById(getBlocks(), toggleBlockId);
    if (!toggle) return;
    const { headerContent, children, focusBlockId } = applyToggleHeaderEnter(
      toggle.children,
      before,
      after,
    );
    onChange(updateBlockById(getBlocks(), toggleBlockId, b => ({
      ...b,
      content: headerContent,
      collapsed: false,
      children,
    })));
    requestAnimationFrame(() => {
      const handler = getFocusHandler(focusBlockId);
      if (handler) handler({ blockId: focusBlockId, offset: 'start' });
    });
  }, [onChange]);

  const renderToggleNested = useCallback<ToggleNestedRenderer>((toggleBlock) => (
    React.createElement(NestedEditor, {
      blocks: toggleBlock.children,
      onChange: (children: Block[]) => {
        onChange(updateBlockById(getBlocks(), toggleBlock.id, b => ({ ...b, children })));
      },
      colors,
      readOnly,
      searchQuery,
      depth: depth + 1,
      wikiTargets,
      onWikiNavigate,
      onActiveBlockChange,
      externalFocusId: undefined,
      getRootBlocks,
      onRootChange,
      searchScope,
      searchMatchIndex,
      onEscapeToParentBelow: () => {
        const newBlock = makeBlock('paragraph');
        onChange(insertBlockAfter(getRootBlocks(), toggleBlock.id, newBlock));
        requestAnimationFrame(() => {
          const h = getFocusHandler(newBlock.id);
          if (h) h({ blockId: newBlock.id, offset: 'start' });
        });
      },
      onEscapeToParentHeader: () => {
        const h = getFocusHandler(toggleBlock.id);
        if (h) h({ blockId: toggleBlock.id, offset: 'end' });
      },
      onMergeFirstChildIntoHeader: (childId: string, childContent: string) => {
        const root = getRootBlocks();
        const toggle = findBlockById(root, toggleBlock.id);
        if (!toggle) return;
        const result = applyToggleChildMergeIntoHeader(
          toggle.content,
          toggle.children,
          childId,
          childContent,
        );
        if (!result) return;
        onChange(updateBlockById(root, toggleBlock.id, t => ({
          ...t,
          content: result.headerContent,
          children: result.children,
        })));
        requestAnimationFrame(() => {
          const h = getFocusHandler(toggleBlock.id);
          if (h) h({ blockId: toggleBlock.id, offset: result.focusOffset });
        });
      },
    })
  ), [
    onChange, colors, readOnly, searchQuery, depth, wikiTargets, onWikiNavigate,
    onActiveBlockChange, getRootBlocks, onRootChange, searchScope, searchMatchIndex,
  ]);

  return {
    handleToggleAddChild,
    handleToggleEnter,
    renderToggleNested,
  };
}
