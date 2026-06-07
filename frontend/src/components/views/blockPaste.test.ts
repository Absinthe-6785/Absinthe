import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { applyPasteAtBlock, normalizePasteText, pasteMarkdownIntoContent } from './blockPaste';

describe('blockPaste', () => {
  it('normalizePasteText', () => {
    expect(normalizePasteText('a\r\nb\u00a0c\n')).toBe('a\nb c');
  });

  it('inline paste replaces selection', () => {
    const b = makeBlock('paragraph', { id: 'x', content: 'hello world' });
    const result = applyPasteAtBlock([b], 'x', 6, 11, 'there');
    expect(result?.blocks[0].content).toBe('hello there');
    expect(result?.focusOffset).toBe(11);
  });

  it('multiline paste creates blocks', () => {
    const b = makeBlock('paragraph', { id: 'x', content: 'before after' });
    const result = applyPasteAtBlock([b], 'x', 6, 6, '- one\n- two');
    expect(result?.blocks).toHaveLength(2);
    expect(result?.blocks[0].type).toBe('bullet');
    expect(result?.blocks[1].type).toBe('bullet');
  });

  it('pasteMarkdownIntoContent merges single line', () => {
    const { blocks, focusOffset } = pasteMarkdownIntoContent('ab', 1, 'X');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toBe('aXb');
    expect(focusOffset).toBe(2);
  });
});
