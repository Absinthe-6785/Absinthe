import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import {
  applyFormatToBlock,
  insertNewlineInBlock,
  splitBlockContent,
  splitBlocksAt,
} from './blockContent';

describe('Shift+Enter inside paragraph', () => {
  it('inserts newline at end of paragraph', () => {
    expect(insertNewlineInBlock('hello', 5)).toEqual({
      content: 'hello\n',
      caret: 6,
    });
  });

  it('inserts newline in the middle', () => {
    expect(insertNewlineInBlock('hello world', 5)).toEqual({
      content: 'hello\n world',
      caret: 6,
    });
  });

  it('preserves trailing newline in block content', () => {
    const first = insertNewlineInBlock('line one', 8);
    expect(first.content).toBe('line one\n');
    const second = insertNewlineInBlock(first.content, first.caret);
    expect(second.content).toBe('line one\n\n');
  });
});

describe('Shift+Enter inside bold text', () => {
  it('inserts raw newline inside bold markers', () => {
    // **hello** → split before second l
    const text = '**hello**';
    const offset = text.indexOf('ll');
    expect(insertNewlineInBlock(text, offset)).toEqual({
      content: '**he\nllo**',
      caret: offset + 1,
    });
  });

  it('splits bold content at caret for Enter', () => {
    const { before, after } = splitBlockContent('**bold**', 5);
    expect(before).toBe('**bol**');
    expect(after).toBe('**d**');
  });
});

describe('Bold toggle in one block does not modify adjacent blocks', () => {
  it('only updates the targeted block', () => {
    const blocks = [
      makeBlock('paragraph', { content: 'first block' }),
      makeBlock('paragraph', { content: 'second block' }),
      makeBlock('paragraph', { content: 'third block' }),
    ];
    const next = applyFormatToBlock(blocks, blocks[1].id, 0, 6, '**', '**');
    expect(next[0].content).toBe('first block');
    expect(next[1].content).toBe('**second** block');
    expect(next[2].content).toBe('third block');
    expect(next.map(b => b.id)).toEqual(blocks.map(b => b.id));
  });
});

describe('Enter split only affects current block', () => {
  it('splits one block and inserts a new block after it', () => {
    const blocks = [
      makeBlock('paragraph', { content: 'hello world' }),
      makeBlock('paragraph', { content: 'neighbor' }),
    ];
    const { blocks: next, newBlockId } = splitBlocksAt(blocks, blocks[0].id, 5);
    expect(next).toHaveLength(3);
    expect(next[0].content).toBe('hello');
    expect(next[1].content).toBe(' world');
    expect(next[1].id).toBe(newBlockId);
    expect(next[2].content).toBe('neighbor');
    expect(next[2].id).toBe(blocks[1].id);
  });

  it('does not modify blocks when id is unknown', () => {
    const blocks = [makeBlock('paragraph', { content: 'only' })];
    const { blocks: next, newBlockId } = splitBlocksAt(blocks, 'missing', 1);
    expect(next).toBe(blocks);
    expect(newBlockId).toBeNull();
  });
});
