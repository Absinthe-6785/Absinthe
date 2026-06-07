import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import {
  adaptPastedBlocks,
  applyPasteAtBlock,
  extractClipboardText,
  htmlToPlainText,
  isBareUrl,
  normalizePasteText,
  pasteMarkdownIntoContent,
  smartInlineMerge,
} from './blockPaste';

describe('blockPaste', () => {
  it('normalizePasteText', () => {
    expect(normalizePasteText('a\r\nb\u00a0c\n')).toBe('a\nb c');
    expect(normalizePasteText('a\tb')).toBe('a  b');
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

  it('isBareUrl', () => {
    expect(isBareUrl('https://example.com')).toBe(true);
    expect(isBareUrl('not a url')).toBe(false);
  });

  it('smartInlineMerge wraps selection with URL', () => {
    const { content, focusOffset } = smartInlineMerge('read ', 'this', 'https://x.com', ' now');
    expect(content).toBe('read [this](https://x.com) now');
    expect(focusOffset).toBe(content.length - 4);
  });

  it('adaptPastedBlocks inherits list type for plain lines', () => {
    const parsed = [
      makeBlock('paragraph', { content: 'one' }),
      makeBlock('paragraph', { content: 'two' }),
    ];
    const adapted = adaptPastedBlocks(parsed, { blockType: 'bullet', indent: 1 });
    expect(adapted[0].type).toBe('bullet');
    expect(adapted[0].indent).toBe(1);
    expect(adapted[1].type).toBe('bullet');
  });

  it('htmlToPlainText preserves line breaks', () => {
    expect(htmlToPlainText('<p>line1</p><p>line2</p>')).toBe('line1\nline2');
    expect(htmlToPlainText('a<br>b')).toBe('a\nb');
  });

  it('extractClipboardText falls back to HTML', () => {
    const dt = {
      getData: (type: string) => (type === 'text/html' ? '<p>hi</p>' : ''),
    };
    expect(extractClipboardText(dt)).toBe('hi');
  });

  it('list context paste converts plain multiline to bullets', () => {
    const b = makeBlock('bullet', { id: 'x', content: 'item', indent: 1 });
    const result = applyPasteAtBlock([b], 'x', 4, 4, 'a\nb', { blockType: 'bullet', indent: 1 });
    expect(result?.blocks).toHaveLength(2);
    expect(result?.blocks[0].type).toBe('bullet');
    expect(result?.blocks[0].indent).toBe(1);
    expect(result?.blocks[1].indent).toBe(1);
  });
});
