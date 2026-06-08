// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { clipboardToBlocks, isDocumentLevelPaste } from './pasteOrchestrator';

const TABLE_SANDWICH_HTML = `<h1>Title</h1><p>A</p><table><tr><th>H</th></tr><tr><td>1</td></tr></table><p>B</p><ul><li>C</li></ul>`;

const DEGRADED_PLAIN = '| H |\n| --- |\n| 1 |';

function mockClipboard(html: string, plain: string) {
  return { getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? plain : '') };
}

describe('pasteOrchestrator', () => {
  it('prefers HTML over degraded plain when both exist', () => {
    const blocks = clipboardToBlocks(mockClipboard(TABLE_SANDWICH_HTML, DEGRADED_PLAIN));
    expect(blocks).toBeTruthy();
    expect(blocks!.map(b => b.type)).toEqual([
      'heading1', 'paragraph', 'table', 'paragraph', 'bullet',
    ]);
  });

  it('falls back to plain when HTML has no block structure', () => {
    const plain = '# Title\n\nParagraph';
    const blocks = clipboardToBlocks(mockClipboard('<span>inline</span>', plain));
    expect(blocks!.some(b => b.type === 'heading1')).toBe(true);
    expect(blocks!.some(b => b.type === 'paragraph')).toBe(true);
  });

  it('falls back to plain when HTML parse yields nothing useful', () => {
    const plain = '- one\n- two';
    const blocks = clipboardToBlocks(mockClipboard('<br>', plain));
    expect(blocks!.map(b => b.type)).toEqual(['bullet', 'bullet']);
  });

  it('isDocumentLevelPaste is true for multi-block HTML paste', () => {
    const blocks = clipboardToBlocks(mockClipboard(TABLE_SANDWICH_HTML, ''));
    expect(isDocumentLevelPaste(mockClipboard(TABLE_SANDWICH_HTML, ''), blocks)).toBe(true);
  });

  it('isDocumentLevelPaste is false for single-line inline paste', () => {
    const blocks = clipboardToBlocks(mockClipboard('', 'hello'));
    expect(isDocumentLevelPaste(mockClipboard('', 'hello'), blocks)).toBe(false);
  });

  it('parses multiline markdown plain when no HTML', () => {
    const plain = '## Sub\n\nPara\n\n- a\n- b';
    const blocks = clipboardToBlocks(mockClipboard('', plain))!;
    expect(blocks.some(b => b.type === 'heading2')).toBe(true);
    expect(blocks.filter(b => b.type === 'bullet')).toHaveLength(2);
  });

  it('returns null for empty clipboard', () => {
    expect(clipboardToBlocks(mockClipboard('', ''))).toBeNull();
  });
});
