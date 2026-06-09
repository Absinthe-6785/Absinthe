import { describe, expect, it } from 'vitest';
import { makeBlock } from '../../../blockUtils';
import { validateBlockTree } from './blockTreeValidator';
import { repairBlockTree } from './repairBlockTree';

describe('repairBlockTree — no-op', () => {
  it('returns the same blocks reference for a valid tree', () => {
    const blocks = [
      makeBlock('paragraph', { id: 'p1', content: 'ok' }),
      makeBlock('numbered', { id: 'n1', content: 'one', listIndex: 1, indent: 0 }),
      makeBlock('numbered', { id: 'n2', content: 'two', listIndex: 2, indent: 0 }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks).toBe(blocks);
    expect(result.repairsApplied).toEqual([]);
  });

  it('does not mutate the input tree', () => {
    const blocks = [
      makeBlock('bullet', { id: 'b1', content: 'item', indent: -2 }),
    ];
    const snapshot = JSON.stringify(blocks);
    repairBlockTree(blocks);
    expect(JSON.stringify(blocks)).toBe(snapshot);
  });
});

describe('repairBlockTree — NEGATIVE_INDENT', () => {
  it('clamps negative indent to zero', () => {
    const blocks = [
      makeBlock('bullet', { id: 'b1', content: 'item', indent: -1 }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks[0].indent).toBe(0);
    expect(result.repairsApplied).toContain('clamp_indent');
    expect(result.blocks).not.toBe(blocks);
  });

  it('clamps deeply nested negative indent', () => {
    const child = makeBlock('paragraph', { id: 'c1', content: 'child', indent: -3 });
    const toggle = makeBlock('toggle', { id: 't1', content: 'T', children: [child] });
    const result = repairBlockTree([toggle]);
    expect(result.blocks[0].children[0].indent).toBe(0);
    expect(result.repairsApplied).toEqual(['clamp_indent']);
  });
});

describe('repairBlockTree — LIST_CONTINUITY', () => {
  it('renumbers a broken numbered list run', () => {
    const blocks = [
      makeBlock('numbered', { id: 'n1', content: 'one', listIndex: 1, indent: 0 }),
      makeBlock('numbered', { id: 'n2', content: 'three', listIndex: 3, indent: 0 }),
      makeBlock('numbered', { id: 'n3', content: 'five', listIndex: 5, indent: 0 }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks.map(b => b.listIndex)).toEqual([1, 2, 3]);
    expect(result.repairsApplied).toContain('renumber_lists');
  });

  it('renumbers numbered lists inside toggle children', () => {
    const child = makeBlock('numbered', { id: 'n2', content: 'bad', listIndex: 4, indent: 0 });
    const toggle = makeBlock('toggle', { id: 't1', content: 'T', children: [
      makeBlock('numbered', { id: 'n1', content: 'one', listIndex: 1, indent: 0 }),
      child,
    ] });
    const result = repairBlockTree([toggle]);
    expect(result.blocks[0].children.map(b => b.listIndex)).toEqual([1, 2]);
    expect(result.repairsApplied).toEqual(['renumber_lists']);
  });

  it('restarts numbering per indent level', () => {
    const blocks = [
      makeBlock('numbered', { id: 'n1', content: 'one', listIndex: 1, indent: 0 }),
      makeBlock('numbered', { id: 'n2', content: 'nested', listIndex: 9, indent: 1 }),
      makeBlock('numbered', { id: 'n3', content: 'top', listIndex: 9, indent: 0 }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks.map(b => b.listIndex)).toEqual([1, 1, 1]);
    expect(result.repairsApplied).toContain('renumber_lists');
  });
});

describe('repairBlockTree — STALE_LIST_FIELDS', () => {
  it('removes listIndex from non-numbered blocks', () => {
    const blocks = [
      makeBlock('paragraph', { id: 'p1', content: 'x', listIndex: 4 }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks[0].listIndex).toBeUndefined();
    expect('listIndex' in result.blocks[0]).toBe(false);
    expect(result.repairsApplied).toContain('strip_field');
  });

  it('removes checked from non-todo blocks', () => {
    const blocks = [
      makeBlock('paragraph', { id: 'p1', content: 'x', checked: true }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks[0].checked).toBeUndefined();
    expect('checked' in result.blocks[0]).toBe(false);
    expect(result.repairsApplied).toContain('strip_field');
  });

  it('preserves listIndex on numbered blocks and checked on todo blocks', () => {
    const blocks = [
      makeBlock('numbered', { id: 'n1', content: 'one', listIndex: 1 }),
      makeBlock('todo', { id: 't1', content: 'task', checked: true }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks[0].listIndex).toBe(1);
    expect(result.blocks[1].checked).toBe(true);
    expect(result.repairsApplied).not.toContain('strip_field');
  });
});

describe('repairBlockTree — INVALID_INDENT_RELATIONSHIP', () => {
  it('resets heading indent to zero', () => {
    const blocks = [
      makeBlock('heading2', { id: 'h1', content: 'Title', indent: 2 }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks[0].indent).toBe(0);
    expect(result.repairsApplied).toContain('reset_indent');
  });

  it('resets divider indent to zero', () => {
    const blocks = [
      makeBlock('divider', { id: 'd1', indent: 1 }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks[0].indent).toBe(0);
    expect(result.repairsApplied).toEqual(['reset_indent']);
  });

  it('preserves indent on list block types', () => {
    const blocks = [
      makeBlock('bullet', { id: 'b1', content: 'item', indent: 2 }),
      makeBlock('numbered', { id: 'n1', content: 'item', indent: 1, listIndex: 1 }),
      makeBlock('todo', { id: 't1', content: 'task', indent: 3 }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks.map(b => b.indent)).toEqual([2, 1, 3]);
    expect(result.repairsApplied).not.toContain('reset_indent');
  });
});

describe('repairBlockTree — EMPTY_DOCUMENT', () => {
  it('inserts a default paragraph block', () => {
    const result = repairBlockTree([]);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe('paragraph');
    expect(result.blocks[0].id).toBeTruthy();
    expect(result.blocks[0].content).toBe('');
    expect(result.repairsApplied).toEqual(['insert_default_block']);
  });
});

describe('repairBlockTree — reporting', () => {
  it('returns unique repairs in stable order', () => {
    const blocks = [
      makeBlock('heading1', { id: 'h1', content: 'Title', indent: 2 }),
      makeBlock('paragraph', { id: 'p1', content: 'x', listIndex: 2, checked: true }),
      makeBlock('numbered', { id: 'n1', content: 'one', listIndex: 1, indent: 0 }),
      makeBlock('numbered', { id: 'n2', content: 'three', listIndex: 3, indent: 0 }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.repairsApplied).toEqual([
      'strip_field',
      'reset_indent',
      'renumber_lists',
    ]);
  });

  it('combines clamp_indent with reset_indent when both apply', () => {
    const blocks = [
      makeBlock('paragraph', { id: 'p1', content: 'x', indent: -2 }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks[0].indent).toBe(0);
    expect(result.repairsApplied).toEqual(['clamp_indent']);
  });
});

describe('repairBlockTree — deferred violations', () => {
  it('does not repair duplicate ids', () => {
    const blocks = [
      makeBlock('paragraph', { id: 'dup', content: 'a' }),
      makeBlock('paragraph', { id: 'dup', content: 'b' }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks).toBe(blocks);
    expect(result.repairsApplied).toEqual([]);
    expect(validateBlockTree(result.blocks).violations.some(v => v.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('does not repair type field mismatch', () => {
    const blocks = [
      makeBlock('paragraph', { id: 'p1', content: 'x', src: 'https://example.com/a.png' }),
      makeBlock('image', { id: 'img', alt: 'missing source' }),
    ];
    const result = repairBlockTree(blocks);
    expect(result.blocks[0].src).toBe('https://example.com/a.png');
    expect(result.blocks[1].src).toBeUndefined();
    expect(result.repairsApplied).toEqual([]);
    expect(validateBlockTree(result.blocks).violations.some(v => v.code === 'TYPE_FIELD_MISMATCH')).toBe(true);
  });

  it('does not repair unknown type', () => {
    const block = makeBlock('paragraph', { id: 'x', content: 'y' });
    (block as { type: string }).type = 'plus';
    const result = repairBlockTree([block]);
    expect((result.blocks[0] as { type: string }).type).toBe('plus');
    expect(result.repairsApplied).toEqual([]);
  });

  it('does not repair non-toggle children', () => {
    const child = makeBlock('paragraph', { id: 'c1', content: 'child' });
    const parent = makeBlock('paragraph', { id: 'p1', content: 'parent', children: [child] });
    const result = repairBlockTree([parent]);
    expect(result.blocks[0].children).toHaveLength(1);
    expect(result.repairsApplied).toEqual([]);
  });
});

describe('repairBlockTree — validation loop', () => {
  it('clears supported warnings after repair', () => {
    const blocks = [
      makeBlock('heading2', { id: 'h1', content: 'Title', indent: 2 }),
      makeBlock('paragraph', { id: 'p1', content: 'x', listIndex: 4 }),
      makeBlock('numbered', { id: 'n1', content: 'one', listIndex: 1, indent: 0 }),
      makeBlock('numbered', { id: 'n2', content: 'three', listIndex: 3, indent: 0 }),
    ];
    const before = validateBlockTree(blocks);
    expect(before.violations.some(v => v.code === 'INVALID_INDENT_RELATIONSHIP')).toBe(true);
    expect(before.violations.some(v => v.code === 'STALE_LIST_FIELDS')).toBe(true);
    expect(before.violations.some(v => v.code === 'LIST_CONTINUITY')).toBe(true);

    const repaired = repairBlockTree(blocks);
    const after = validateBlockTree(repaired.blocks);
    expect(after.violations.filter(v =>
      v.code === 'INVALID_INDENT_RELATIONSHIP'
      || v.code === 'STALE_LIST_FIELDS'
      || v.code === 'LIST_CONTINUITY',
    )).toHaveLength(0);
  });

  it('does not throw during repair', () => {
    expect(() => repairBlockTree([
      makeBlock('bullet', { id: 'b1', content: 'item', indent: -5 }),
      makeBlock('numbered', { id: 'n1', content: 'one', listIndex: 1 }),
      makeBlock('numbered', { id: 'n2', content: 'nine', listIndex: 9 }),
    ])).not.toThrow();
  });
});
