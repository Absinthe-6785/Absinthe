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
  isValidImageUrl,
  imageAltFromUrl,
  filterBlockMenu,
} from './blockUtils';

describe('isValidImageUrl / imageAltFromUrl', () => {
  it('accepts https and data URLs', () => {
    expect(isValidImageUrl('https://example.com/a.png')).toBe(true);
    expect(isValidImageUrl('data:image/png;base64,abc')).toBe(true);
    expect(isValidImageUrl('ftp://x.com/a.png')).toBe(false);
    expect(isValidImageUrl('not-a-url')).toBe(false);
  });

  it('extracts alt from URL path', () => {
    expect(imageAltFromUrl('https://cdn.example.com/photos/sunset.jpg')).toBe('sunset');
  });
});

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
  it('roundtrips paragraph and headings with blank lines', () => {
    const md = '# Title\n\nBody text\n\n## Sub';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('preserves consecutive blank lines', () => {
    const md = 'Line A\n\n\nLine B';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('roundtrips bullet and todo lists', () => {
    const md = '- item one\n- item two\n- [x] done\n- [ ] todo';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('roundtrips code block', () => {
    const md = '```ts\nconst x = 1;\n```';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('roundtrips math block ($$ delimiters preserved)', () => {
    const md = '$$\na^2 + b^2\n$$';
    const blocks = markdownToBlocks(md);
    expect(blocks[0].type).toBe('math');
    expect(blocks[0].math).toBe('a^2 + b^2');
    expect(blocks[0].mathBlock).toBe(true);
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('roundtrips inline math ($...$)', () => {
    const md = '$E=mc^2$';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('roundtrips numbered list with original indices', () => {
    const md = '1. first\n2. second\n3. third';
    const blocks = markdownToBlocks(md);
    expect(blocks.map(b => b.listIndex)).toEqual([1, 2, 3]);
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('roundtrips table', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
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

  it('roundtrips image caption without width', () => {
    const md = '![fig](https://example.com/a.png "My caption")';
    const blocks = markdownToBlocks(md);
    expect(blocks[0].caption).toBe('My caption');
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('roundtrips empty image placeholder', () => {
    const md = '![]()';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('roundtrips footnote definition and inline reference', () => {
    const md = 'See note[^1] here.\n\n[^1]: First reference.';
    const blocks = markdownToBlocks(md);
    expect(blocks.some(b => b.type === 'footnote')).toBe(true);
    expect(blocks.find(b => b.type === 'paragraph')?.content).toContain('[^1]');
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('roundtrips mermaid fenced block', () => {
    const md = '```mermaid\nflowchart TD\n  A --> B\n```';
    const blocks = markdownToBlocks(md);
    expect(blocks[0].type).toBe('mermaid');
    expect(blocks[0].mermaid).toContain('flowchart TD');
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('roundtrips audio fenced block with caption', () => {
    const md = '```audio\nhttps://example.com/audio.mp3\nLesson clip\n```';
    const blocks = markdownToBlocks(md);
    expect(blocks[0].type).toBe('audio');
    expect(blocks[0].src).toBe('https://example.com/audio.mp3');
    expect(blocks[0].caption).toBe('Lesson clip');
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('roundtrips toggle with children', () => {
    const md = '> Toggle title\n  child line';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('roundtrips collapsed toggle (>!)', () => {
    const md = '>! Collapsed\n  hidden child';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('roundtrips toggle with empty title and children', () => {
    const blocks = [
      makeBlock('toggle', { content: '', children: [makeBlock('paragraph', { content: 'child' })] }),
    ];
    const md = blocksToMarkdown(blocks);
    const parsed = markdownToBlocks(md);
    expect(parsed[0].type).toBe('toggle');
    expect(parsed[0].content).toBe('');
    expect(parsed[0].children[0].content).toBe('child');
    expect(blocksToMarkdown(parsed)).toBe(md);
  });

  it('roundtrips empty toggle without children as collapsed marker', () => {
    const blocks = [makeBlock('toggle', { content: '', children: [], collapsed: false })];
    const md = blocksToMarkdown(blocks);
    expect(md).toBe('>!');
    const parsed = markdownToBlocks(md);
    expect(parsed[0].type).toBe('toggle');
    expect(parsed[0].content).toBe('');
    expect(blocksToMarkdown(parsed)).toBe(md);
  });

  it('roundtrips callout', () => {
    const md = '> 💡 Important note';
    const blocks = markdownToBlocks(md);
    expect(blocks[0].type).toBe('callout');
    expect(blocks[0].calloutIcon).toBe('💡');
    expect(blocks[0].content).toBe('Important note');
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('roundtrips callout variants', () => {
    const md = '> ℹ Reference info';
    const blocks = markdownToBlocks(md);
    expect(blocks[0].type).toBe('callout');
    expect(blocks[0].calloutIcon).toBe('ℹ');
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('parses Obsidian callout aliases and serializes to Absinthe emoji format', () => {
    const md = '> [!tip] Remember this\n> second line';
    const blocks = markdownToBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('callout');
    expect(blocks[0].calloutIcon).toBe('💡');
    expect(blocks[0].content).toBe('Remember this\nsecond line');
    expect(blocksToMarkdown(blocks).startsWith('> 💡 ')).toBe(true);
  });

  it('maps Obsidian note/warning/question aliases', () => {
    expect(markdownToBlocks('> [!note] Info')[0].calloutIcon).toBe('ℹ');
    expect(markdownToBlocks('> [!warning] Careful')[0].calloutIcon).toBe('⚠');
    expect(markdownToBlocks('> [!question] Why?')[0].calloutIcon).toBe('❓');
  });

  it('roundtrips toggle heading with children', () => {
    const md = '#> Section\n  nested line';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
    const blocks = markdownToBlocks(md);
    expect(blocks[0].type).toBe('toggleHeading1');
    expect(blocks[0].children[0].content).toBe('nested line');
  });

  it('roundtrips collapsed toggle heading', () => {
    const md = '##>! Hidden\n  child';
    const blocks = markdownToBlocks(md);
    expect(blocks[0].type).toBe('toggleHeading2');
    expect(blocks[0].collapsed).toBe(true);
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('roundtrips heading4', () => {
    const md = '#### Detail section';
    const blocks = markdownToBlocks(md);
    expect(blocks[0].type).toBe('heading4');
    expect(blocks[0].content).toBe('Detail section');
    expect(blocksToMarkdown(blocks)).toBe(md);
  });

  it('preserves unicode symbols through round-trip', () => {
    const md = '→ ⇒ ≤ ≥ √ ∑ ∞';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('roundtrips quote (single line, no children)', () => {
    const md = '> A single quote';
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });
});

describe('block helpers', () => {
  let blocks: ReturnType<typeof markdownToBlocks>;

  beforeEach(() => {
    blocks = markdownToBlocks('first\n\nsecond'); // first, blank, second
  });

  it('insertBlockAfter inserts after target id', () => {
    const id = blocks[0].id;
    const nb = makeBlock('paragraph', { content: 'inserted' });
    const next = insertBlockAfter(blocks, id, nb);
    expect(next.map(b => b.content)).toEqual(['first', 'inserted', '', 'second']);
  });

  it('deleteBlockById removes block', () => {
    const next = deleteBlockById(blocks, blocks[0].id);
    expect(next.map(b => b.content)).toEqual(['', 'second']);
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

describe('filterBlockMenu', () => {
  it('pins common types first when query is empty', () => {
    const types = filterBlockMenu('').map(m => m.type);
    expect(types.slice(0, 5)).toEqual(['paragraph', 'heading1', 'heading2', 'heading3', 'heading4']);
  });

  it('filters by english alias heading', () => {
    const types = filterBlockMenu('heading').map(m => m.type);
    expect(types).toContain('heading1');
    expect(types).toContain('heading2');
    expect(types.some(t => t === 'todo')).toBe(false);
  });

  it('filters toggle and callout by keyword', () => {
    expect(filterBlockMenu('toggle1').some(m => m.menuKey === 'toggle1')).toBe(true);
    expect(filterBlockMenu('info').some(m => m.menuKey === 'info')).toBe(true);
  });
});
