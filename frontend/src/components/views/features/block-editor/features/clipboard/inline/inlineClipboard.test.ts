// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  elementInlineToMarkdown,
  markdownInlineToHtml,
} from './inlineClipboard';
import { blocksToCopyHtml, applySemanticCopy } from '../copy/blockCopy';
import { clipboardToBlocks } from '../paste/pasteOrchestrator';
import { htmlDocumentToBlocks } from '../paste/htmlDocumentToBlocks';
import { makeBlock } from '../../../../../blockUtils';

function mockClipboard(html: string, plain = '') {
  return { getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? plain : '') };
}

describe('markdownInlineToHtml (copy)', () => {
  it('serializes bold', () => {
    expect(markdownInlineToHtml('**bold**')).toBe('<strong>bold</strong>');
  });

  it('serializes italic', () => {
    expect(markdownInlineToHtml('*italic*')).toBe('<em>italic</em>');
  });

  it('serializes underline', () => {
    expect(markdownInlineToHtml('++under++')).toBe('<u>under</u>');
  });

  it('serializes inline code', () => {
    expect(markdownInlineToHtml('`code`')).toBe('<code>code</code>');
  });

  it('serializes wiki link', () => {
    expect(markdownInlineToHtml('see [[Note]]')).toBe('see <a href="#">Note</a>');
  });

  it('serializes markdown link', () => {
    expect(markdownInlineToHtml('[docs](https://example.com)')).toBe(
      '<a href="https://example.com">docs</a>',
    );
  });

  it('serializes bold italic', () => {
    expect(markdownInlineToHtml('***both***')).toBe('<strong><em>both</em></strong>');
  });
});

describe('elementInlineToMarkdown (paste)', () => {
  it('deserializes strong/b', () => {
    const doc = new DOMParser().parseFromString('<p><strong>bold</strong></p>', 'text/html');
    expect(elementInlineToMarkdown(doc.body.firstChild as Element)).toBe('**bold**');
  });

  it('deserializes em/i', () => {
    const doc = new DOMParser().parseFromString('<p><em>italic</em></p>', 'text/html');
    expect(elementInlineToMarkdown(doc.body.firstChild as Element)).toBe('*italic*');
  });

  it('deserializes u', () => {
    const doc = new DOMParser().parseFromString('<p><u>under</u></p>', 'text/html');
    expect(elementInlineToMarkdown(doc.body.firstChild as Element)).toBe('++under++');
  });

  it('deserializes code', () => {
    const doc = new DOMParser().parseFromString('<p><code>fn</code></p>', 'text/html');
    expect(elementInlineToMarkdown(doc.body.firstChild as Element)).toBe('`fn`');
  });

  it('deserializes anchor link', () => {
    const doc = new DOMParser().parseFromString(
      '<p><a href="https://x.com">link</a></p>',
      'text/html',
    );
    expect(elementInlineToMarkdown(doc.body.firstChild as Element)).toBe('[link](https://x.com)');
  });

  it('deserializes hash-only anchor as wiki link', () => {
    const doc = new DOMParser().parseFromString('<p><a href="#">Note</a></p>', 'text/html');
    expect(elementInlineToMarkdown(doc.body.firstChild as Element)).toBe('[[Note]]');
  });
});

describe('cross-source HTML paste fixtures', () => {
  it('Google Docs styled span → markdown emphasis', () => {
    const html = '<p><span style="font-weight:700">bold</span> and <span style="font-style:italic">italic</span></p>';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks[0].content).toBe('**bold** and *italic*');
  });

  it('Word b/i/u tags → markdown', () => {
    const html = '<p><b>bold</b> <i>italic</i> <u>under</u></p>';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks[0].content).toBe('**bold** *italic* ++under++');
  });

  it('Notion-style semantic tags → markdown', () => {
    const html = '<p><strong>item</strong> with <a href="https://ref.io">reference</a></p>';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks[0].content).toBe('**item** with [reference](https://ref.io)');
  });
});

describe('rich clipboard round-trip', () => {
  it('copy → HTML → paste preserves inline formatting', () => {
    const original = makeBlock('paragraph', {
      content: '**important** [link](https://a.com) and `code`',
    });
    const html = blocksToCopyHtml([original]);
    expect(html).toContain('<strong>important</strong>');
    expect(html).toContain('<a href="https://a.com">link</a>');
    expect(html).toContain('<code>code</code>');

    const parsed = clipboardToBlocks(mockClipboard(html, ''))!;
    expect(parsed[0].content).toBe('**important** [link](https://a.com) and `code`');
  });

  it('bullet list item preserves bold on copy round-trip', () => {
    const original = makeBlock('bullet', { content: '**important item**' });
    const data: Record<string, string> = {};
    applySemanticCopy([original], { setData: (t, v) => { data[t] = v; } });
    const parsed = clipboardToBlocks({ getData: t => data[t] ?? '' })!;
    expect(parsed[0].type).toBe('bullet');
    expect(parsed[0].content).toBe('**important item**');
    expect(data['text/html']).toContain('<strong>important item</strong>');
  });

  it('external HTML → paste → copy round-trip', () => {
    const externalHtml = '<p><strong>important item</strong> and <a href="https://ref.io">reference link</a> and <code>snippet</code></p>';
    const pasted = clipboardToBlocks(mockClipboard(externalHtml, ''))!;
    expect(pasted[0].content).toContain('**important item**');
    expect(pasted[0].content).toContain('[reference link](https://ref.io)');
    expect(pasted[0].content).toContain('`snippet`');

    const reCopied = blocksToCopyHtml(pasted);
    expect(reCopied).toContain('<strong>important item</strong>');
    expect(reCopied).toContain('<a href="https://ref.io">reference link</a>');
    expect(reCopied).toContain('<code>snippet</code>');
  });
});
