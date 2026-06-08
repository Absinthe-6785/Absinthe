import { describe, expect, it } from 'vitest';
import { makeBlock, markdownToBlocks } from './blockUtils';
import { loadValidatedBlocks, repairBlock, validateDocument } from './documentRecovery';

describe('documentRecovery', () => {
  it('validateDocument returns paragraph for non-array input', () => {
    const blocks = validateDocument(null);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].id).toBeTruthy();
  });

  it('repairBlock assigns id when missing', () => {
    const block = repairBlock({ type: 'paragraph', content: 'hi' });
    expect(block?.id).toBeTruthy();
    expect(block?.type).toBe('paragraph');
    expect(block?.content).toBe('hi');
  });

  it('repairBlock coerces unknown type to paragraph', () => {
    const block = repairBlock({ id: 'x', type: 'plus', content: 'oops' });
    expect(block?.type).toBe('paragraph');
    expect(block?.content).toBe('oops');
  });

  it('repairBlock repairs null children to empty array', () => {
    const block = repairBlock({ id: 't', type: 'toggle', content: 'h', children: null });
    expect(block?.children).toEqual([]);
  });

  it('repairBlock falls back broken table to paragraph', () => {
    const block = repairBlock({
      id: 'tbl',
      type: 'table',
      tableHeaders: null,
      tableRows: [['a']],
      content: 'fallback text',
    });
    expect(block?.type).toBe('paragraph');
    expect(block?.content).toBe('fallback text');
  });

  it('repairBlock normalizes valid table', () => {
    const block = repairBlock({
      id: 'tbl',
      type: 'table',
      tableHeaders: ['A', 'B'],
      tableRows: [['1']],
    });
    expect(block?.type).toBe('table');
    expect(block?.tableHeaders).toEqual(['A', 'B']);
    expect(block?.tableRows).toEqual([['1', '']]);
  });

  it('validateDocument repairs nested children', () => {
    const blocks = validateDocument([
      { id: 'p', type: 'toggle', content: 'parent', children: [{ type: 'plus', content: 'child' }] },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].children).toHaveLength(1);
    expect(blocks[0].children[0].type).toBe('paragraph');
  });

  it('loadValidatedBlocks parses markdown then validates', () => {
    const md = '# Title\n\nHello';
    const blocks = loadValidatedBlocks(md, markdownToBlocks);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every(b => b.id && b.type)).toBe(true);
  });

  it('validateDocument never returns empty array', () => {
    expect(validateDocument([])).toEqual([expect.objectContaining({ type: 'paragraph' })]);
    expect(validateDocument([null])).toHaveLength(1);
  });

  it('repairBlock returns paragraph for non-object input', () => {
    const block = repairBlock('bad');
    expect(block?.type).toBe('paragraph');
  });
});
