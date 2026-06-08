// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { insertToggleFooterParagraph } from './toggleFooterInsertion';
import { makeBlock } from './blockUtils';

describe('toggleFooterInsertion', () => {
  it('appends child paragraph at end of expanded toggle', () => {
    const toggle = makeBlock('toggle', {
      id: 'econ',
      content: 'Economics',
      collapsed: false,
      children: [
        makeBlock('paragraph', { id: 'a', content: 'Child A' }),
        makeBlock('paragraph', { id: 'b', content: 'Child B' }),
      ],
    });

    const result = insertToggleFooterParagraph([toggle], 'econ');
    expect(result).not.toBeNull();
    expect(result!.created).toBe(true);
    expect(result!.focusBlockId).not.toBe('a');
    expect(result!.focusBlockId).not.toBe('b');

    const updated = result!.blocks[0];
    expect(updated.children).toHaveLength(3);
    expect(updated.children[2].type).toBe('paragraph');
    expect(updated.children[2].content).toBe('');
    expect(updated.collapsed).toBe(false);
  });

  it('reuses existing trailing empty child paragraph', () => {
    const empty = makeBlock('paragraph', { id: 'empty', content: '' });
    const toggle = makeBlock('toggle', {
      id: 'econ',
      content: 'Economics',
      collapsed: false,
      children: [
        makeBlock('paragraph', { id: 'a', content: 'Child A' }),
        empty,
      ],
    });

    const rootBlocks = [toggle];
    const result = insertToggleFooterParagraph(rootBlocks, 'econ');
    expect(result!.created).toBe(false);
    expect(result!.focusBlockId).toBe('empty');
    expect(result!.blocks).toBe(rootBlocks);
    expect(result!.blocks[0].children).toHaveLength(2);
  });

  it('no-op for collapsed toggle', () => {
    const toggle = makeBlock('toggle', {
      id: 'econ',
      content: 'Economics',
      collapsed: true,
      children: [makeBlock('paragraph', { content: 'hidden' })],
    });
    expect(insertToggleFooterParagraph([toggle], 'econ')).toBeNull();
  });

  it('nested toggle footer insertion targets nested toggle children', () => {
    const inner = makeBlock('toggle', {
      id: 'inner',
      content: 'Nested',
      collapsed: false,
      children: [makeBlock('paragraph', { id: 'ic', content: 'inner child' })],
    });
    const outer = makeBlock('toggle', {
      id: 'outer',
      content: 'Outer',
      collapsed: false,
      children: [inner],
    });

    const result = insertToggleFooterParagraph([outer], 'inner');
    expect(result!.created).toBe(true);
    const updatedInner = result!.blocks[0].children[0];
    expect(updatedInner.children).toHaveLength(2);
    expect(updatedInner.children[1].type).toBe('paragraph');
    expect(updatedInner.children[1].content).toBe('');
  });
});
