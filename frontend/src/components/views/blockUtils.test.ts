import { describe, it, expect, beforeEach } from 'vitest';
import {
  markdownToBlocks,
  blocksToMarkdown,
  makeBlock,
  insertBlockAfter,
  deleteBlockById,
  updateBlockById,
  insertImageAfter,
  flattenBlockIds,
  parseImageTitle,
  formatImageTitle,
  convertBlock,
  isTextBlockType,
} from './blockUtils';

describe('parseImageTitle / formatImageTitle', () => {
  it('parses caption and width', () => {
    expect(parseImageTitle('My caption|w:400')).toEqual({ caption: 'My caption', width: 400 });
  });

  it('parses width-only title', () => {
    expect(parseImageTitle('|w:320')).toEqual({ caption: undefined, width: 320 });
  });

  it('roundtrips through formatImageTitle', () => {
    const title = formatImageTitle('Fig 1', 500);
    expect(title).toBe('Fig 1|w:500');
    expect(parseImageTitle(title!)).toEqual({ caption: 'Fig 1', width: 500 });
  });
});

describe('markdownToBlocks ↔ blocksToMarkdown', () => {
  it('roundtrips paragraph and headings (blank lines between blocks collapse)', () => {
    const md = '# Title\n\nBody text\n\n## Sub';
    const out = blocksToMarkdown(markdownToBlocks(md));
    expect(out).toContain('# Title');
    expect(out).toContain('Body text');
    expect(out).toContain('## Sub');
  });

  it('roundtrips bullet and todo lists', () => {
    const md = '- item one\n- item two\n- [x] done\n- [ ] todo';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('roundtrips code block', () => {
    const md = '```ts\nconst x = 1;\n```';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('roundtrips math block (single-line expr serializes inline)', () => {
    const md = '$$\na^2 + b^2\n$$';
    const blocks = markdownToBlocks(md);
    expect(blocks[0].type).toBe('math');
    expect(blocks[0].math).toBe('a^2 + b^2');
    expect(blocksToMarkdown(blocks)).toBe('$a^2 + b^2$');
  });

  it('roundtrips table (divider width normalized)', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const blocks = markdownToBlocks(md);
    expect(blocks[0].tableHeaders).toEqual(['A', 'B']);
    expect(blocks[0].tableRows).toEqual([['1', '2']]);
    const out = blocksToMarkdown(blocks);
    expect(out).toContain('| A | B |');
    expect(out).toContain('| 1 | 2 |');
  });

  it('roundtrips image with caption and width', () => {
    const md = '![photo](data:image/png;base64,abc "caption|w:300")';
    const blocks = markdownToBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('image');
    expect(blocks[0].caption).toBe('caption');
    expect(blocks[0].width).toBe(300);
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('roundtrips toggle with children', () => {
    const md = '> Toggle title\n  child line';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });
});

describe('block helpers', () => {
  let blocks: ReturnType<typeof markdownToBlocks>;

  beforeEach(() => {
    blocks = markdownToBlocks('first\n\nsecond');
  });

  it('insertBlockAfter inserts after target id', () => {
    const id = blocks[0].id;
    const nb = makeBlock('paragraph', { content: 'inserted' });
    const next = insertBlockAfter(blocks, id, nb);
    expect(next.map(b => b.content)).toEqual(['first', 'inserted', 'second']);
  });

  it('deleteBlockById removes block', () => {
    const next = deleteBlockById(blocks, blocks[0].id);
    expect(next.map(b => b.content)).toEqual(['second']);
  });

  it('updateBlockById patches block', () => {
    const next = updateBlockById(blocks, blocks[0].id, b => ({ ...b, content: 'updated' }));
    expect(next[0].content).toBe('updated');
  });

  it('insertImageAfter places image after active block', () => {
    const afterId = blocks[0].id;
    const { blocks: next, imageId } = insertImageAfter(blocks, afterId, 'data:x', 'img');
    const ids = flattenBlockIds(next);
    expect(ids.indexOf(imageId)).toBe(ids.indexOf(afterId) + 1);
    expect(next.find(b => b.id === imageId)?.type).toBe('image');
  });

  it('insertImageAfter appends when afterId is null', () => {
    const { blocks: next, imageId } = insertImageAfter(blocks, null, 'data:x', 'img');
    expect(next[next.length - 1].id).toBe(imageId);
  });

  it('convertBlock changes type preserving content', () => {
    const para = makeBlock('paragraph', { content: 'hello' });
    const h1 = convertBlock(para, 'heading1');
    expect(h1.type).toBe('heading1');
    expect(h1.content).toBe('hello');
  });

  it('isTextBlockType identifies editable text blocks', () => {
    expect(isTextBlockType('paragraph')).toBe(true);
    expect(isTextBlockType('image')).toBe(false);
    expect(isTextBlockType('code')).toBe(false);
  });
});
