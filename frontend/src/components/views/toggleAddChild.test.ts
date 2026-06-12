import { describe, expect, it } from 'vitest';
import { appendToggleChildParagraph } from './toggleFooterInsertion';
import { makeBlock } from './blockUtils';

describe('appendToggleChildParagraph', () => {
  it('appends a child paragraph without overwriting existing children', () => {
    const toggle = makeBlock('toggle', {
      id: 'parent',
      content: 'Parent',
      collapsed: false,
      children: [
        makeBlock('paragraph', { id: 'c1', content: 'Child 1' }),
        makeBlock('paragraph', { id: 'c2', content: 'Child 2' }),
      ],
    });

    const result = appendToggleChildParagraph([toggle], 'parent');
    expect(result).not.toBeNull();
    expect(result!.created).toBe(true);
    expect(result!.blocks[0].children).toHaveLength(3);
    expect(result!.blocks[0].children[2].type).toBe('paragraph');
    expect(result!.focusBlockId).toBe(result!.blocks[0].children[2].id);
  });

  it('reuses trailing empty paragraph instead of appending duplicates', () => {
    const empty = makeBlock('paragraph', { id: 'empty', content: '' });
    const toggle = makeBlock('toggle', {
      id: 'parent',
      content: 'Parent',
      collapsed: false,
      children: [makeBlock('paragraph', { id: 'c1', content: 'Child 1' }), empty],
    });

    const result = appendToggleChildParagraph([toggle], 'parent');
    expect(result!.created).toBe(false);
    expect(result!.focusBlockId).toBe('empty');
    expect(result!.blocks[0].children).toHaveLength(2);
  });
});
