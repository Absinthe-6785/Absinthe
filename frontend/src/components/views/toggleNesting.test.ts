import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import {
  applyToggleChildEnter,
  applyToggleHeaderEnter,
  splitToggleChildrenSequential,
} from './toggleNesting';

describe('3+ consecutive Enter presses inside toggle', () => {
  it('creates a new child for each non-empty Enter', () => {
    const first = makeBlock('paragraph', { id: 'c1', content: '' });
    let children = [first];

    children = splitToggleChildrenSequential(children, 'c1', ['line 1', 'line 2', 'line 3']);

    expect(children).toHaveLength(4);
    expect(children[0].content).toBe('line 1');
    expect(children[1].content).toBe('line 2');
    expect(children[2].content).toBe('line 3');
    expect(children[3].content).toBe('');
  });

  it('appends children on header Enter instead of prepending', () => {
    const existing = makeBlock('paragraph', { id: 'c1', content: 'line 1' });
    const { children, focusBlockId } = applyToggleHeaderEnter([existing]);
    expect(children.map(b => b.id)).toEqual(['c1', focusBlockId]);
    expect(children[1].content).toBe('');
  });
});

describe('nested toggle children', () => {
  it('allows 3+ children inside a nested toggle without affecting outer siblings', () => {
    const outerSibling = makeBlock('paragraph', { id: 'sib', content: 'sibling' });
    const inner = makeBlock('toggle', { id: 'inner', content: 'Inner', children: [] });
    const outer = makeBlock('toggle', {
      id: 'outer',
      content: 'Outer',
      children: [outerSibling, inner],
    });

    const { children: innerChildren, focusBlockId } = applyToggleHeaderEnter(inner.children);
    const nested = splitToggleChildrenSequential(innerChildren, focusBlockId, [
      'nested 1',
      'nested 2',
      'nested 3',
    ]);

    inner.children = nested;
    expect(inner.children).toHaveLength(4);
    expect(outer.children).toHaveLength(2);
    expect(outer.children[0].id).toBe('sib');
    expect(outer.children[1].children).toHaveLength(4);
  });
});

describe('empty child block Enter exits toggle', () => {
  it('removes the empty last child and signals escape', () => {
    const children = [
      makeBlock('paragraph', { id: 'c1', content: 'line 1' }),
      makeBlock('paragraph', { id: 'c2', content: '' }),
    ];
    const result = applyToggleChildEnter(children, 'c2', '', '', true);
    expect(result.action).toBe('escape_below');
    if (result.action === 'escape_below') {
      expect(result.children).toHaveLength(1);
      expect(result.children[0].content).toBe('line 1');
    }
  });
});

describe('non-empty child block Enter stays inside toggle', () => {
  it('splits into a sibling within children', () => {
    const children = [makeBlock('paragraph', { id: 'c1', content: 'line 1' })];
    const result = applyToggleChildEnter(children, 'c1', 'line 1', '', true);
    expect(result.action).toBe('split');
    if (result.action === 'split') {
      expect(result.children).toHaveLength(2);
      expect(result.children[0].content).toBe('line 1');
      expect(result.children[1].content).toBe('');
      expect(result.focusBlockId).toBe(result.children[1].id);
    }
  });

  it('does not escape when splitting mid-content', () => {
    const children = [makeBlock('paragraph', { id: 'c1', content: 'abcdef' })];
    const result = applyToggleChildEnter(children, 'c1', 'abc', 'def', true);
    expect(result.action).toBe('split');
    if (result.action === 'split') {
      expect(result.children[0].content).toBe('abc');
      expect(result.children[1].content).toBe('def');
    }
  });
});
