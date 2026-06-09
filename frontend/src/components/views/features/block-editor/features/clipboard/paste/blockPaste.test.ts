// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as blockUtils from '../../../../../blockUtils';
import { makeBlock } from '../../../../../blockUtils';
import {
  adaptPastedBlocks,
  applyPasteAtBlock,
  applyPasteBlocksAt,
  clipboardToBlocks,
  extractClipboardText,
  htmlToPlainText,
  isBareUrl,
  isDocumentLevelPaste,
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

  it('applyPasteBlocksAt splices pre-parsed blocks at caret', () => {
    const b = makeBlock('paragraph', { id: 'x', content: 'start end' });
    const pasted = [
      makeBlock('heading1', { content: 'H' }),
      makeBlock('paragraph', { content: 'body' }),
    ];
    const result = applyPasteBlocksAt([b], 'x', 5, 5, pasted);
    expect(result?.blocks).toHaveLength(2);
    expect(result?.blocks[0].content).toBe('startH');
    expect(result?.blocks[1].content).toBe('body end');
    expect(result?.focusBlockId).toBe(result?.blocks[1].id);
  });

  it('applyPasteBlocksAt inherits list type in list context', () => {
    const b = makeBlock('bullet', { id: 'x', content: '', indent: 2 });
    const pasted = [
      makeBlock('paragraph', { content: 'a' }),
      makeBlock('paragraph', { content: 'b' }),
    ];
    const result = applyPasteBlocksAt([b], 'x', 0, 0, pasted, { blockType: 'bullet', indent: 2 });
    expect(result?.blocks.every(bl => bl.type === 'bullet' && bl.indent === 2)).toBe(true);
  });

  it('applyPasteBlocksAt returns null for empty input', () => {
    const b = makeBlock('paragraph', { id: 'x', content: '' });
    expect(applyPasteBlocksAt([b], 'x', 0, 0, [])).toBeNull();
  });

  it('clipboardToBlocks re-export parses HTML-first', () => {
    const html = '<h1>T</h1><p>P</p>';
    const dt = { getData: (t: string) => (t === 'text/html' ? html : t === 'text/plain' ? 'broken' : '') };
    const blocks = clipboardToBlocks(dt);
    expect(blocks?.map(bl => bl.type)).toEqual(['heading1', 'paragraph']);
  });

  it('isDocumentLevelPaste detects structured HTML single block', () => {
    const html = '<h1>Only</h1>';
    const dt = { getData: (t: string) => (t === 'text/html' ? html : '') };
    const blocks = clipboardToBlocks(dt)!;
    expect(isDocumentLevelPaste(dt, blocks)).toBe(true);
  });
});

describe('applyPasteAtBlock tree validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('valid multiline paste does not throw', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('DEV', true);
    const b = makeBlock('paragraph', { id: 'x', content: 'before after' });
    expect(() => applyPasteAtBlock([b], 'x', 6, 6, '- one\n- two')).not.toThrow();
    const result = applyPasteAtBlock([b], 'x', 6, 6, '- one\n- two');
    expect(result?.blocks).toHaveLength(2);
  });

  it('throws when generated tree is invalid in DEV/TEST', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('DEV', true);
    vi.spyOn(blockUtils, 'markdownToBlocks').mockReturnValue([
      makeBlock('paragraph', { id: 'other', content: 'a' }),
      makeBlock('paragraph', { id: 'dup', content: 'b' }),
    ]);
    const b = makeBlock('paragraph', { id: 'dup', content: 'start' });
    expect(() => applyPasteAtBlock([b], 'dup', 0, 0, 'line1\nline2')).toThrow(
      /Tree validation failed/,
    );
    expect(() => applyPasteAtBlock([b], 'dup', 0, 0, 'line1\nline2')).toThrow(
      /DUPLICATE_ID/,
    );
  });

  it('includes applyPasteAtBlock context in validation error', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('DEV', true);
    vi.spyOn(blockUtils, 'markdownToBlocks').mockReturnValue([
      makeBlock('paragraph', { id: 'other', content: 'a' }),
      makeBlock('paragraph', { id: 'dup', content: 'b' }),
    ]);
    const b = makeBlock('paragraph', { id: 'dup', content: 'start' });
    expect(() => applyPasteAtBlock([b], 'dup', 0, 0, 'line1\nline2')).toThrow(
      /Context: applyPasteAtBlock/,
    );
  });

  it('skips validation in production mode', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('DEV', false);
    vi.stubEnv('MODE', 'production');
    vi.spyOn(blockUtils, 'markdownToBlocks').mockReturnValue([
      makeBlock('paragraph', { id: 'other', content: 'a' }),
      makeBlock('paragraph', { id: 'dup', content: 'b' }),
    ]);
    const b = makeBlock('paragraph', { id: 'dup', content: 'start' });
    expect(() => applyPasteAtBlock([b], 'dup', 0, 0, 'line1\nline2')).not.toThrow();
    const result = applyPasteAtBlock([b], 'dup', 0, 0, 'line1\nline2');
    expect(result?.blocks).toHaveLength(2);
  });
});
