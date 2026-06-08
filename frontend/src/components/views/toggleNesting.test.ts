import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import {
  applyToggleChildEnter,
  applyToggleChildMergeIntoHeader,
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

  it('appends children on header Enter at end instead of prepending', () => {
    const existing = makeBlock('paragraph', { id: 'c1', content: 'line 1' });
    const { children, focusBlockId } = applyToggleHeaderEnter([existing], 'title', '');
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

    const { children: innerChildren, focusBlockId } = applyToggleHeaderEnter(inner.children, '', '');
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

describe('toggle child list Enter parity (UX-4C.2)', () => {
  it('empty numbered last child exits to paragraph instead of escaping toggle', () => {
    const children = [
      makeBlock('numbered', { id: 'n1', content: 'one', listIndex: 1 }),
      makeBlock('numbered', { id: 'n2', content: 'two', listIndex: 2 }),
      makeBlock('numbered', { id: 'n3', content: '', listIndex: 3 }),
    ];
    const result = applyToggleChildEnter(children, 'n3', '', '', true);
    expect(result.action).toBe('split');
    if (result.action === 'split') {
      expect(result.children).toHaveLength(3);
      expect(result.children[2].type).toBe('paragraph');
      expect(result.children[2].listIndex).toBeUndefined();
      expect(result.focusBlockId).toBe('n3');
    }
  });

  it('empty bullet last child exits to paragraph', () => {
    const children = [
      makeBlock('bullet', { id: 'b1', content: 'item' }),
      makeBlock('bullet', { id: 'b2', content: '' }),
    ];
    const result = applyToggleChildEnter(children, 'b2', '', '', true);
    expect(result.action).toBe('split');
    if (result.action === 'split') {
      expect(result.children[1].type).toBe('paragraph');
    }
  });

  it('empty todo last child exits to paragraph', () => {
    const children = [
      makeBlock('todo', { id: 't1', content: 'task', checked: true }),
      makeBlock('todo', { id: 't2', content: '', checked: false }),
    ];
    const result = applyToggleChildEnter(children, 't2', '', '', true);
    expect(result.action).toBe('split');
    if (result.action === 'split') {
      expect(result.children[1].type).toBe('paragraph');
      expect(result.children[1].checked).toBeUndefined();
    }
  });

  it('toggle header Enter splits at caret (UX-4C.3)', () => {
    const existing = makeBlock('paragraph', { id: 'c1', content: 'existing' });
    const mid = applyToggleHeaderEnter([existing], 'Grammar', 'Module');
    expect(mid.headerContent).toBe('Grammar');
    expect(mid.children).toHaveLength(2);
    expect(mid.children[0].content).toBe('Module');
    expect(mid.children[1].id).toBe('c1');

    const end = applyToggleHeaderEnter([], 'Grammar Module', '');
    expect(end.headerContent).toBe('Grammar Module');
    expect(end.children).toHaveLength(1);
    expect(end.children[0].content).toBe('');

    const start = applyToggleHeaderEnter([], '', 'Grammar Module');
    expect(start.headerContent).toBe('');
    expect(start.children[0].content).toBe('Grammar Module');
  });

  it('first child merges into toggle header on Backspace@0 (UX-4C.3)', () => {
    const child = makeBlock('paragraph', { id: 'c1', content: 'Module' });
    const result = applyToggleChildMergeIntoHeader('Grammar', [child], 'c1', 'Module');
    expect(result).not.toBeNull();
    expect(result!.headerContent).toBe('GrammarModule');
    expect(result!.children).toHaveLength(0);
    expect(result!.focusOffset).toBe(7);
  });

  it('rejects merge when block is not first child (UX-4C.3)', () => {
    const first = makeBlock('paragraph', { id: 'c1', content: 'A' });
    const second = makeBlock('paragraph', { id: 'c2', content: 'B' });
    expect(applyToggleChildMergeIntoHeader('Title', [first, second], 'c2', 'B')).toBeNull();
  });

  it('nested toggle header split prepends before existing children (UX-4C.3)', () => {
    const innerChild = makeBlock('paragraph', { id: 'ic', content: 'existing' });
    const split = applyToggleHeaderEnter([innerChild], 'In', 'ner');
    expect(split.headerContent).toBe('In');
    expect(split.children).toHaveLength(2);
    expect(split.children[0].content).toBe('ner');
    expect(split.children[1].id).toBe('ic');
  });

  it('numbered split renumbers toggle children', () => {
    const children = [
      makeBlock('numbered', { id: 'n1', content: 'A', listIndex: 1 }),
      makeBlock('numbered', { id: 'n2', content: 'B', listIndex: 2 }),
    ];
    const result = applyToggleChildEnter(children, 'n2', 'B', '', true);
    expect(result.action).toBe('split');
    if (result.action === 'split') {
      expect(result.children).toHaveLength(3);
      expect(result.children.map(b => b.listIndex)).toEqual([1, 2, 3]);
      expect(result.children[0].content).toBe('A');
      expect(result.children[1].content).toBe('B');
      expect(result.children[2].content).toBe('');
    }
  });
});
