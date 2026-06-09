import { describe, expect, it } from 'vitest';
import { makeBlock } from '../../../blockUtils';
import { validateBlockTree } from './blockTreeValidator';

describe('validateBlockTree — valid trees', () => {
  it('accepts a simple paragraph document', () => {
    const result = validateBlockTree([
      makeBlock('paragraph', { id: 'p1', content: 'Hello' }),
    ]);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.stats.blockCount).toBe(1);
    expect(result.stats.uniqueIdCount).toBe(1);
    expect(result.stats.maxDepth).toBe(0);
  });

  it('accepts toggle nesting with nestable children', () => {
    const child = makeBlock('paragraph', { id: 'c1', content: 'child' });
    const toggle = makeBlock('toggle', { id: 't1', content: 'Toggle', children: [child] });
    const result = validateBlockTree([toggle]);
    expect(result.valid).toBe(true);
    expect(result.stats.blockCount).toBe(2);
    expect(result.stats.maxDepth).toBe(1);
  });

  it('accepts a numbered list document', () => {
    const result = validateBlockTree([
      makeBlock('numbered', { id: 'n1', content: 'one', listIndex: 1, indent: 0 }),
      makeBlock('numbered', { id: 'n2', content: 'two', listIndex: 2, indent: 0 }),
    ]);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('accepts a valid table block', () => {
    const result = validateBlockTree([
      makeBlock('table', {
        id: 'tbl',
        tableHeaders: ['A', 'B'],
        tableRows: [['1', '2'], ['3', '4']],
      }),
    ]);
    expect(result.valid).toBe(true);
  });

  it('accepts todo with checked field', () => {
    const result = validateBlockTree([
      makeBlock('todo', { id: 'td1', content: 'task', checked: true }),
    ]);
    expect(result.valid).toBe(true);
  });
});

describe('validateBlockTree — EMPTY_DOCUMENT', () => {
  it('reports error for empty root array', () => {
    const result = validateBlockTree([]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'EMPTY_DOCUMENT',
      severity: 'error',
      path: 'root',
    }));
    expect(result.stats.blockCount).toBe(0);
  });
});

describe('validateBlockTree — DUPLICATE_ID', () => {
  it('detects duplicate ids at root', () => {
    const result = validateBlockTree([
      makeBlock('paragraph', { id: 'dup', content: 'a' }),
      makeBlock('paragraph', { id: 'dup', content: 'b' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID',
      blockId: 'dup',
      path: 'root[1]',
    }));
    expect(result.stats.uniqueIdCount).toBe(1);
  });

  it('detects duplicate ids across root and nested levels', () => {
    const nested = makeBlock('paragraph', { id: 'shared', content: 'nested' });
    const toggle = makeBlock('toggle', {
      id: 't1',
      content: 'T',
      children: [nested],
    });
    const result = validateBlockTree([
      makeBlock('paragraph', { id: 'shared', content: 'root' }),
      toggle,
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.code === 'DUPLICATE_ID')).toBe(true);
  });
});

describe('validateBlockTree — MISSING_ID', () => {
  it('reports empty id', () => {
    const result = validateBlockTree([
      makeBlock('paragraph', { id: '', content: 'x' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'MISSING_ID',
      path: 'root[0]',
    }));
  });

  it('reports undefined id', () => {
    const block = makeBlock('paragraph', { content: 'x' });
    (block as { id: string | undefined }).id = undefined as unknown as string;
    const result = validateBlockTree([block]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'MISSING_ID',
    }));
  });
});

describe('validateBlockTree — UNKNOWN_TYPE', () => {
  it('reports unknown block type', () => {
    const block = makeBlock('paragraph', { id: 'x' });
    (block as { type: string }).type = 'plus';
    const result = validateBlockTree([block]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'UNKNOWN_TYPE',
      blockId: 'x',
    }));
  });
});

describe('validateBlockTree — NEGATIVE_INDENT', () => {
  it('reports negative indent', () => {
    const result = validateBlockTree([
      makeBlock('bullet', { id: 'b1', content: 'item', indent: -1 }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'NEGATIVE_INDENT',
      blockId: 'b1',
    }));
  });
});

describe('validateBlockTree — toggle violations', () => {
  it('rejects image inside toggle', () => {
    const image = makeBlock('image', { id: 'img', src: 'https://example.com/a.png' });
    const toggle = makeBlock('toggle', { id: 't1', content: 'T', children: [image] });
    const result = validateBlockTree([toggle]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'NON_NESTABLE_IN_TOGGLE',
      blockId: 'img',
      path: 'root[0].children[0]',
    }));
  });

  it('rejects table inside toggle', () => {
    const table = makeBlock('table', {
      id: 'tbl',
      tableHeaders: ['A'],
      tableRows: [['1']],
    });
    const toggle = makeBlock('toggle', { id: 't1', content: 'T', children: [table] });
    const result = validateBlockTree([toggle]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'NON_NESTABLE_IN_TOGGLE',
      blockId: 'tbl',
    }));
  });

  it('rejects divider inside toggle', () => {
    const divider = makeBlock('divider', { id: 'd1' });
    const toggle = makeBlock('toggle', { id: 't1', content: 'T', children: [divider] });
    const result = validateBlockTree([toggle]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'NON_NESTABLE_IN_TOGGLE',
      blockId: 'd1',
    }));
  });
});

describe('validateBlockTree — table violations', () => {
  it('rejects missing headers', () => {
    const result = validateBlockTree([
      makeBlock('table', { id: 'tbl', tableHeaders: [], tableRows: [['x']] }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'INVALID_TABLE_SHAPE',
      blockId: 'tbl',
    }));
  });

  it('rejects undefined headers', () => {
    const block = makeBlock('table', { id: 'tbl', tableRows: [['x']] });
    delete block.tableHeaders;
    const result = validateBlockTree([block]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'INVALID_TABLE_SHAPE',
    }));
  });

  it('rejects ragged rows', () => {
    const result = validateBlockTree([
      makeBlock('table', {
        id: 'tbl',
        tableHeaders: ['A', 'B'],
        tableRows: [['1'], ['2', '3', '4']],
      }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v =>
      v.code === 'INVALID_TABLE_SHAPE' && v.message.includes('row 0'),
    )).toBe(true);
    expect(result.violations.some(v =>
      v.code === 'INVALID_TABLE_SHAPE' && v.message.includes('row 1'),
    )).toBe(true);
  });
});

describe('validateBlockTree — warnings', () => {
  it('warns when paragraph has children', () => {
    const child = makeBlock('paragraph', { id: 'c1', content: 'hidden' });
    const parent = makeBlock('paragraph', { id: 'p1', content: 'parent', children: [child] });
    const result = validateBlockTree([parent]);
    expect(result.valid).toBe(true);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'NON_TOGGLE_HAS_CHILDREN',
      severity: 'warning',
      blockId: 'p1',
    }));
    expect(result.stats.blockCount).toBe(2);
  });

  it('warns on stale listIndex on paragraph', () => {
    const result = validateBlockTree([
      makeBlock('paragraph', { id: 'p1', content: 'x', listIndex: 2 }),
    ]);
    expect(result.valid).toBe(true);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'STALE_LIST_FIELDS',
      severity: 'warning',
      message: expect.stringContaining('listIndex'),
    }));
  });

  it('warns on stale checked on paragraph', () => {
    const result = validateBlockTree([
      makeBlock('paragraph', { id: 'p1', content: 'x', checked: true }),
    ]);
    expect(result.valid).toBe(true);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'STALE_LIST_FIELDS',
      severity: 'warning',
      message: expect.stringContaining('checked'),
    }));
  });

  it('warns on heading with children', () => {
    const child = makeBlock('paragraph', { id: 'c1' });
    const heading = makeBlock('heading1', { id: 'h1', content: 'Title', children: [child] });
    const result = validateBlockTree([heading]);
    expect(result.valid).toBe(true);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'NON_TOGGLE_HAS_CHILDREN',
      blockId: 'h1',
    }));
  });
});

describe('validateBlockTree — statistics', () => {
  it('computes block count and max depth in one pass', () => {
    const deep = makeBlock('paragraph', { id: 'deep' });
    const mid = makeBlock('toggle', { id: 'mid', content: 'M', children: [deep] });
    const root = makeBlock('toggle', { id: 'root', content: 'R', children: [mid] });
    const result = validateBlockTree([root, makeBlock('paragraph', { id: 'sibling' })]);
    expect(result.stats.blockCount).toBe(4);
    expect(result.stats.idCount).toBe(4);
    expect(result.stats.uniqueIdCount).toBe(4);
    expect(result.stats.maxDepth).toBe(2);
  });

  it('does not mutate the input tree', () => {
    const blocks = [
      makeBlock('paragraph', { id: 'p1', content: 'before' }),
    ];
    const snapshot = JSON.stringify(blocks);
    validateBlockTree(blocks);
    expect(JSON.stringify(blocks)).toBe(snapshot);
  });
});

describe('validateBlockTree — deep nesting paths', () => {
  it('reports nested violation paths', () => {
    const image = makeBlock('image', { id: 'img', src: 'x' });
    const toggle = makeBlock('toggle', { id: 't1', content: 'T', children: [image] });
    const result = validateBlockTree([toggle]);
    expect(result.violations[0]?.path).toBe('root[0].children[0]');
  });

  it('tracks depth for deeply nested toggles', () => {
    const l3 = makeBlock('paragraph', { id: 'l3' });
    const l2 = makeBlock('toggle', { id: 'l2', content: 'L2', children: [l3] });
    const l1 = makeBlock('toggle', { id: 'l1', content: 'L1', children: [l2] });
    const result = validateBlockTree([l1]);
    expect(result.valid).toBe(true);
    expect(result.stats.maxDepth).toBe(2);
    expect(result.stats.blockCount).toBe(3);
  });
});

describe('validateBlockTree — list field validity', () => {
  it('allows listIndex only on numbered blocks', () => {
    const result = validateBlockTree([
      makeBlock('bullet', { id: 'b1', content: 'x', listIndex: 1 }),
    ]);
    expect(result.valid).toBe(true);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'STALE_LIST_FIELDS',
      message: expect.stringContaining('listIndex'),
    }));
  });

  it('allows checked only on todo blocks', () => {
    const result = validateBlockTree([
      makeBlock('numbered', { id: 'n1', content: 'x', checked: true }),
    ]);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'STALE_LIST_FIELDS',
      message: expect.stringContaining('checked'),
    }));
  });
});

describe('validateBlockTree — whitespace id', () => {
  it('treats whitespace-only id as missing', () => {
    const result = validateBlockTree([
      makeBlock('paragraph', { id: '   ', content: 'x' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'MISSING_ID',
    }));
  });
});

describe('validateBlockTree — table edge cases', () => {
  it('accepts table with no rows', () => {
    const result = validateBlockTree([
      makeBlock('table', { id: 'tbl', tableHeaders: ['A'], tableRows: [] }),
    ]);
    expect(result.valid).toBe(true);
  });

  it('accepts table with non-array row as ragged violation', () => {
    const block = makeBlock('table', {
      id: 'tbl',
      tableHeaders: ['A', 'B'],
      tableRows: [null as unknown as string[]],
    });
    const result = validateBlockTree([block]);
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'INVALID_TABLE_SHAPE',
    }));
  });
});

describe('validateBlockTree — multiple violations', () => {
  it('collects independent errors in one traversal', () => {
    const bad = makeBlock('paragraph', { id: '', content: 'x', indent: -2 });
    (bad as { type: string }).type = 'unknown';
    const result = validateBlockTree([bad]);
    expect(result.valid).toBe(false);
    const codes = result.violations.map(v => v.code);
    expect(codes).toContain('MISSING_ID');
    expect(codes).toContain('UNKNOWN_TYPE');
    expect(codes).toContain('NEGATIVE_INDENT');
  });
});
