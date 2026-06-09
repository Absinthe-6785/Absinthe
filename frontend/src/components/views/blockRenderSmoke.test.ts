// @vitest-environment happy-dom
/**
 * Regression: block renderers must mount in edit mode without ReferenceError
 * (catches missing lucide imports e.g. Plus in table edit UI).
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { renderBlockContent } from './blockRegistry';
import { TableBlock } from './TableBlock';
import { BlockContextMenu } from './features/block-editor/features/menus';
import { makeBlock, type BlockType } from './blockUtils';
import type { BlockEditorColors, BlockRenderContext } from './editorTypes';

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

function editCtx(overrides: Partial<BlockRenderContext> = {}): BlockRenderContext {
  return {
    toggleOpen: true,
    inline: s => s,
    onToggleCollapse: () => {},
    onToggleTodo: () => {},
    getBlocks: () => [],
    onChange: () => {},
    searchQuery: '',
    depth: 0,
    readOnly: false,
    wikiTargets: [],
    onSelect: () => {},
    onAddBelow: () => {},
    onSplitBlock: () => {},
    onMergeWithPrev: () => {},
    onContentChange: () => {},
    editableRef: { current: null },
    onSlashOpen: () => {},
    onSlashClose: () => {},
    onWikiOpen: () => {},
    onWikiClose: () => {},
    isMenuOpen: false,
    onToggleAddChild: () => {},
    onToggleEnter: () => {},
    onTableChange: () => {},
    onNavigateBlock: () => {},
    onConvertBlock: () => {},
    getRootBlocks: () => [],
    onRootChange: () => {},
    searchQueryFor: () => '',
    ...overrides,
  };
}

function blockFixture(type: BlockType) {
  const base = makeBlock(type, { content: 'smoke test' });
  switch (type) {
    case 'table':
      return { ...base, tableHeaders: ['A', 'B'], tableRows: [['1', '2']] };
    case 'code':
      return { ...base, language: 'js', code: 'console.log(1)' };
    case 'math':
      return { ...base, math: 'x^2' };
    case 'image':
      return { ...base, src: 'https://example.com/img.png', alt: 'alt' };
    case 'todo':
      return { ...base, checked: false };
    case 'toggle':
      return { ...base, children: [makeBlock('paragraph', { content: 'child' })] };
    default:
      return base;
  }
}

const ALL_BLOCK_TYPES: BlockType[] = [
  'paragraph', 'heading1', 'heading2', 'heading3',
  'bullet', 'numbered', 'todo', 'toggle',
  'code', 'image', 'divider', 'table', 'quote', 'callout', 'math',
];

function mount(node: unknown): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return container;
}

describe('block render smoke', () => {
  for (const type of ALL_BLOCK_TYPES) {
    it(`renderBlockContent(${type}) edit mode does not throw`, () => {
      const block = blockFixture(type);
      const node = renderBlockContent(block, colors, editCtx());
      expect(() => mount(node)).not.toThrow();
    });
  }

  it('TableBlock edit mode mounts Plus/Trash2 row-add control', () => {
    const block = blockFixture('table');
    const el = mount(createElement(TableBlock, {
      block,
      colors,
      readOnly: false,
      inline: (s: string) => s,
      onTableChange: () => {},
    }));
    expect(el.textContent).toContain('행 추가');
  });

  it('BlockContextMenu mounts without throw', () => {
    expect(() => mount(createElement(BlockContextMenu, {
      blockId: 'b1',
      currentType: 'paragraph',
      anchorY: 0,
      anchorX: 0,
      colors,
      onAddAbove: () => {},
      onAddBelow: () => {},
      onDuplicate: () => {},
      onIndent: () => {},
      onOutdent: () => {},
      onMoveIntoToggle: () => {},
      onMoveOutOfToggle: () => {},
      canMoveIntoToggle: false,
      canMoveOutOfToggle: false,
      onSetTint: () => {},
      onCopyLink: () => {},
      onSelect: () => {},
      onDelete: () => {},
      onMoveUp: () => {},
      onMoveDown: () => {},
      onClose: () => {},
    }))).not.toThrow();
  });
});
