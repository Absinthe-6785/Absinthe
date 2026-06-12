import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { toggleSharedEditProps, renderToggleChildren } from './toggleRender';
import type { BlockRenderContext } from './editorTypes';
import { makeBlock } from './blockUtils';

function minimalCtx(): BlockRenderContext {
  return {
    toggleOpen: true,
    inline: s => s,
    onToggleCollapse: () => {},
    onToggleTodo: () => {},
    getBlocks: () => [],
    onChange: () => {},
    searchQuery: '',
    depth: 1,
    readOnly: false,
    wikiTargets: ['Note'],
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
    searchQueryFor: id => `q-${id}`,
  };
}

describe('toggleRender', () => {
  it('toggleSharedEditProps wires searchQuery per block', () => {
    const block = makeBlock('toggle');
    const props = toggleSharedEditProps(block, minimalCtx());
    expect(props.searchQuery).toBe(`q-${block.id}`);
    expect(props.wikiTargets).toEqual(['Note']);
  });

  it('toggleSharedEditProps includes navigation callbacks', () => {
    const block = makeBlock('toggle');
    const props = toggleSharedEditProps(block, minimalCtx());
    expect(typeof props.onNavigateBlock).toBe('function');
    expect(typeof props.onConvertBlock).toBe('function');
  });

  it('renderToggleChildren shows add-child affordance when toggle has children', () => {
    const toggle = makeBlock('toggle', {
      id: 't1',
      content: 'Section',
      children: [makeBlock('paragraph', { id: 'c1', content: 'One' })],
    });
    const ctx = minimalCtx();
    const html = renderToStaticMarkup(
      createElement('div', null, renderToggleChildren(toggle, ctx, () => null)),
    );
    expect(html).toContain('data-toggle-add-child="t1"');
    expect(html).toContain('블록 추가…');
  });
});
