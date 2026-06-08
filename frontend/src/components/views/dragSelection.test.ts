import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { minimalDragIds } from './dragSelection';

describe('minimalDragIds', () => {
  it('keeps siblings, drops none', () => {
    const blocks = ['a', 'b', 'c'].map(id => makeBlock('paragraph', { id }));
    expect(minimalDragIds(blocks, ['a', 'c'])).toEqual(['a', 'c']);
  });

  it('collapses toggle + descendant to toggle only', () => {
    const child = makeBlock('paragraph', { id: 'c', content: 'child' });
    const inner = makeBlock('toggle', { id: 'it', content: 'inner', children: [child] });
    const toggle = makeBlock('toggle', { id: 't', content: 'outer', children: [inner] });
    const root = [toggle, makeBlock('paragraph', { id: 'x' })];

    expect(minimalDragIds(root, ['t', 'it', 'c'])).toEqual(['t']);
  });

  it('preserves document order', () => {
    const blocks = ['a', 'b', 'c', 'd'].map(id => makeBlock('paragraph', { id }));
    expect(minimalDragIds(blocks, ['d', 'b'])).toEqual(['b', 'd']);
  });
});
