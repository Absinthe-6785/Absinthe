import { describe, expect, it } from 'vitest';
import {
  getBlockRenderer,
  hasBlockRenderer,
  registerBlockRenderer,
  renderBlockContent,
} from './blockRegistry';
import type { BlockRenderContext } from './editorTypes';
import type { BlockEditorColors } from './editorTypes';
import { makeBlock } from './blockUtils';

const c: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

function minimalCtx(overrides: Partial<BlockRenderContext> = {}): BlockRenderContext {
  return {
    toggleOpen: true,
    inline: s => s,
    onToggleCollapse: () => {},
    onToggleTodo: () => {},
    getBlocks: () => [],
    onChange: () => {},
    searchQuery: '',
    depth: 0,
    readOnly: true,
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

describe('blockRegistry', () => {
  it('registers specialized block types', () => {
    expect(hasBlockRenderer('code')).toBe(true);
    expect(hasBlockRenderer('math')).toBe(true);
    expect(hasBlockRenderer('image')).toBe(true);
    expect(hasBlockRenderer('table')).toBe(true);
    expect(hasBlockRenderer('toggle')).toBe(true);
  });

  it('toggle renderer returns null', () => {
    const block = makeBlock('toggle');
    expect(getBlockRenderer('toggle')!(block, c, minimalCtx())).toBeNull();
  });

  it('renderBlockContent handles paragraph in readOnly', () => {
    const block = { ...makeBlock('paragraph'), content: 'hello' };
    const node = renderBlockContent(block, c, minimalCtx({ readOnly: true }));
    expect(node).toBeTruthy();
  });

  it('renderBlockContent handles divider', () => {
    const block = makeBlock('divider');
    const node = renderBlockContent(block, c, minimalCtx());
    expect(node).toBeTruthy();
  });

  it('registerBlockRenderer stores custom renderer', () => {
    registerBlockRenderer('callout', () => 'custom-callout');
    expect(getBlockRenderer('callout')!(makeBlock('callout'), c, minimalCtx())).toBe('custom-callout');
  });
});
