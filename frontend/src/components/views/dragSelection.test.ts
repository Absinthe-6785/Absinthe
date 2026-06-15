import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { expandToggleHeadersInSelection, minimalDragIds, normalizedOpIds } from './dragSelection';

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

describe('expandToggleHeadersInSelection', () => {
  it('adds all descendants when toggle header is in partial range', () => {
    const c = makeBlock('paragraph', { id: 'c', content: 'c' });
    const d = makeBlock('paragraph', { id: 'd', content: 'd' });
    const t = makeBlock('toggle', { id: 't', content: 'toggle', children: [c, d] });
    const b = makeBlock('paragraph', { id: 'b', content: 'b' });
    const blocks = [b, t];

    expect(expandToggleHeadersInSelection(blocks, ['b', 't', 'c'])).toEqual(['b', 't', 'c', 'd']);
  });
});

describe('normalizedOpIds', () => {
  it('collapses toggle header + child to header only', () => {
    const c = makeBlock('paragraph', { id: 'c', content: 'child' });
    const t = makeBlock('toggle', { id: 't', content: 'toggle', children: [c] });
    const blocks = [t];
    expect(normalizedOpIds(blocks, ['t', 'c'])).toEqual(['t']);
  });
});
