import { describe, expect, it } from 'vitest';
import {
  htmlTableToMarkdown,
  looksLikeTsv,
  parseStructuredPaste,
  tsvToMarkdownTable,
  prepareStructuredPasteText,
} from './pasteStructure';
import { markdownToBlocks } from '../../../../../blockUtils';

describe('pasteStructure', () => {
  it('numbered list paste', () => {
    const blocks = parseStructuredPaste('1. One\n2. Two\n3. Three');
    expect(blocks).toHaveLength(3);
    expect(blocks.every(b => b.type === 'numbered')).toBe(true);
  });

  it('bullet list paste', () => {
    const blocks = parseStructuredPaste('- Alpha\n- Beta');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('bullet');
  });

  it('nested bullet paste preserves indent', () => {
    const blocks = markdownToBlocks('- A\n  - B\n  - C');
    expect(blocks).toHaveLength(3);
    expect(blocks[0].indent).toBe(0);
    expect(blocks[1].indent).toBe(1);
    expect(blocks[2].indent).toBe(1);
  });

  it('tsv converts to markdown table', () => {
    const tsv = 'H1\tH2\na\tb';
    expect(looksLikeTsv(tsv)).toBe(true);
    const md = tsvToMarkdownTable(tsv)!;
    expect(md).toContain('| H1 | H2 |');
    const blocks = parseStructuredPaste(md);
    expect(blocks[0].type).toBe('table');
  });

  it('prepareStructuredPasteText prefers TSV table', () => {
    const dt = {
      getData: (type: string) => (type === 'text/plain' ? 'A\tB\n1\t2' : ''),
    };
    const text = prepareStructuredPasteText(dt);
    expect(text).toContain('| A | B |');
  });

  it('html table to markdown', () => {
    const html = '<table><tr><th>X</th><th>Y</th></tr><tr><td>1</td><td>2</td></tr></table>';
    const md = htmlTableToMarkdown(html);
    if (typeof DOMParser !== 'undefined') {
      expect(md).toContain('| X | Y |');
      const blocks = parseStructuredPaste(md!);
      expect(blocks[0].type).toBe('table');
    } else {
      expect(md).toBeNull();
    }
  });
});
