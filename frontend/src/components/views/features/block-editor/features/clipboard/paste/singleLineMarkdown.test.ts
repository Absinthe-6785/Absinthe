// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { parseSingleLineMarkdown } from './singleLineMarkdown';
import { clipboardToBlocks, isDocumentLevelPaste } from './pasteOrchestrator';

function mockClipboard(html: string, plain: string) {
  return { getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? plain : '') };
}

describe('parseSingleLineMarkdown', () => {
  it('parses # Heading as heading1', () => {
    const blocks = parseSingleLineMarkdown('# Heading')!;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('heading1');
    expect(blocks[0].content).toBe('Heading');
  });

  it('parses - Item as bullet', () => {
    const blocks = parseSingleLineMarkdown('- Item')!;
    expect(blocks[0].type).toBe('bullet');
    expect(blocks[0].content).toBe('Item');
  });

  it('parses 1. Item as numbered', () => {
    const blocks = parseSingleLineMarkdown('1. Item')!;
    expect(blocks[0].type).toBe('numbered');
    expect(blocks[0].content).toBe('Item');
    expect(blocks[0].listIndex).toBe(1);
  });

  it('parses > Quote as quote', () => {
    const blocks = parseSingleLineMarkdown('> Quote')!;
    expect(blocks[0].type).toBe('quote');
    expect(blocks[0].content).toBe('Quote');
  });

  it('returns null for plain prose', () => {
    expect(parseSingleLineMarkdown('hello world')).toBeNull();
  });
});

describe('clipboardToBlocks single-line markdown (UX-5B.1)', () => {
  it('converts single-line heading without newline', () => {
    const blocks = clipboardToBlocks(mockClipboard('', '# Project Plan'))!;
    expect(blocks[0].type).toBe('heading1');
    expect(blocks[0].content).toBe('Project Plan');
  });

  it('converts single-line bullet without newline', () => {
    const blocks = clipboardToBlocks(mockClipboard('', '- Task A'))!;
    expect(blocks[0].type).toBe('bullet');
    expect(blocks[0].content).toBe('Task A');
  });

  it('treats single-line markdown as document-level paste', () => {
    const plain = '# Title';
    const blocks = clipboardToBlocks(mockClipboard('', plain));
    expect(isDocumentLevelPaste(mockClipboard('', plain), blocks)).toBe(true);
  });
});
