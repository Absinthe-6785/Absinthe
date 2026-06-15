import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { updateGutterSelection } from './blockGutterSelection';
import { minimalDragIds } from './dragSelection';

describe('blockGutterSelection cross-toggle (K-82)', () => {
  const blocks = [
    { ...makeBlock('paragraph'), id: 'a' },
    { ...makeBlock('paragraph'), id: 'b' },
    { ...makeBlock('toggle'), id: 't', children: [
      { ...makeBlock('paragraph'), id: 'c' },
      { ...makeBlock('paragraph'), id: 'd' },
    ] },
    { ...makeBlock('paragraph'), id: 'e' },
  ];

  it('gutter drag spans toggle boundary', () => {
    expect([...updateGutterSelection(blocks, 'a', 'c')]).toEqual(['a', 'b', 't', 'c']);
  });

  it('minimalDragIds keeps toggle header when children also selected', () => {
    const selected = ['a', 'b', 't', 'c', 'd'];
    expect(minimalDragIds(blocks, selected)).toEqual(['a', 'b', 't']);
  });

  it('minimalDragIds keeps children when toggle header not selected', () => {
    expect(minimalDragIds(blocks, ['c', 'd'])).toEqual(['c', 'd']);
  });
});
