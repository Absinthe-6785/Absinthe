import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { indentListBlock, outdentListBlock } from './listIndent';

describe('listIndent', () => {
  it('indent bullet increases block.indent', () => {
    const a = makeBlock('bullet', { id: 'a', content: 'A', indent: 0 });
    const b = makeBlock('bullet', { id: 'b', content: 'B', indent: 0 });
    const next = indentListBlock([a, b], 'b');
    expect(next![1].indent).toBe(1);
    expect(next![1].type).toBe('bullet');
  });

  it('outdent bullet decreases block.indent', () => {
    const b = makeBlock('bullet', { id: 'b', content: 'B', indent: 2 });
    const next = outdentListBlock([b], 'b');
    expect(next![0].indent).toBe(1);
  });

  it('numbered indent renumbers per level', () => {
    const blocks = [
      makeBlock('numbered', { id: 'a', content: 'one', indent: 0 }),
      makeBlock('numbered', { id: 'b', content: 'two', indent: 0 }),
    ];
    const next = indentListBlock(blocks, 'b');
    expect(next![1].indent).toBe(1);
    expect(next![0].listIndex).toBe(1);
    expect(next![1].listIndex).toBe(1);
  });

  it('todo indent preserves checked state', () => {
    const t = makeBlock('todo', { id: 't', content: 'done', indent: 0, checked: true });
    const next = indentListBlock([t], 't');
    expect(next![0].checked).toBe(true);
    expect(next![0].indent).toBe(1);
  });

  it('nested indent > 2 levels', () => {
    let blocks = [makeBlock('bullet', { id: 'x', content: 'x', indent: 0 })];
    blocks = indentListBlock(blocks, 'x')!;
    blocks = indentListBlock(blocks, 'x')!;
    blocks = indentListBlock(blocks, 'x')!;
    expect(blocks[0].indent).toBe(3);
  });
});
