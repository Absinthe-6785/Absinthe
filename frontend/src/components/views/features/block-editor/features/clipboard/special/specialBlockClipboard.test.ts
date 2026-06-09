// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { makeBlock } from '../../../../../blockUtils';
import {
  applySemanticCopy,
  blocksToCopyHtml,
} from '../copy/blockCopy';
import { clipboardToBlocks } from '../paste/pasteOrchestrator';
import { htmlDocumentToBlocks } from '../paste/htmlDocumentToBlocks';
import {
  codeBlockToHtml,
  imageBlockToHtml,
  mathBlockToHtml,
  parseCodeFromPre,
  parseFencedCodeFromPlain,
  parseImageFromPlain,
  parseMathFromPlain,
} from './specialBlockClipboard';

function mockClipboard(html: string, plain = '') {
  return { getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? plain : '') };
}

function roundTrip(blocks: ReturnType<typeof makeBlock>[]) {
  const data: Record<string, string> = {};
  applySemanticCopy(blocks, { setData: (t, v) => { data[t] = v; } });
  return clipboardToBlocks({ getData: t => data[t] ?? '' })!;
}

describe('code block clipboard (UX-5B.3)', () => {
  it('copy serializes pre/code with language class', () => {
    const html = codeBlockToHtml(makeBlock('code', { language: 'ts', code: 'const x = 1;\n' }));
    expect(html).toBe('<pre class="language-ts"><code class="language-ts">const x = 1;\n</code></pre>');
  });

  it('paste GitHub-style pre/code preserves language and whitespace', () => {
    const html = '<pre class="highlight"><code class="language-typescript">const x = 1;\n</code></pre>';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks[0].type).toBe('code');
    expect(blocks[0].language).toBe('typescript');
    expect(blocks[0].code).toBe('const x = 1;\n');
  });

  it('paste VS Code Web language-javascript class', () => {
    const doc = new DOMParser().parseFromString(
      '<pre><code class="language-javascript">console.log(1)</code></pre>',
      'text/html',
    );
    const block = parseCodeFromPre(doc.body.firstChild as HTMLElement);
    expect(block.language).toBe('javascript');
    expect(block.code).toBe('console.log(1)');
  });

  it('round-trip code block with language', () => {
    const original = makeBlock('code', { language: 'ts', code: 'const x = 1;' });
    const parsed = roundTrip([original]);
    expect(parsed[0].type).toBe('code');
    expect(parsed[0].language).toBe('ts');
    expect(parsed[0].code).toBe('const x = 1;');
  });

  it('plain fenced code paste', () => {
    const plain = '```ts\nconst x = 1;\n```';
    expect(parseFencedCodeFromPlain(plain)?.[0].language).toBe('ts');
    const blocks = clipboardToBlocks(mockClipboard('', plain))!;
    expect(blocks[0].type).toBe('code');
    expect(blocks[0].code).toBe('const x = 1;\n');
  });
});

describe('math block clipboard (UX-5B.3)', () => {
  it('copy serializes math span with data-block-type', () => {
    const html = mathBlockToHtml(makeBlock('math', { math: 'E = mc^2', mathBlock: true }));
    expect(html).toContain('data-block-type="math"');
    expect(html).toContain('data-math-block="true"');
    expect(html).toContain('E = mc^2');
  });

  it('paste math HTML span', () => {
    const html = '<span data-block-type="math" data-math-block="true">E = mc^2</span>';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks[0].type).toBe('math');
    expect(blocks[0].math).toBe('E = mc^2');
    expect(blocks[0].mathBlock).toBe(true);
  });

  it('round-trip math block', () => {
    const original = makeBlock('math', { math: 'E = mc^2', mathBlock: true });
    const parsed = roundTrip([original]);
    expect(parsed[0].type).toBe('math');
    expect(parsed[0].math).toBe('E = mc^2');
    expect(parsed[0].mathBlock).toBe(true);
  });

  it('plain $$ math paste', () => {
    const plain = '$$\nE = mc^2\n$$';
    expect(parseMathFromPlain(plain)?.[0].math).toBe('E = mc^2');
    const blocks = clipboardToBlocks(mockClipboard('', plain))!;
    expect(blocks[0].type).toBe('math');
  });
});

describe('image block clipboard (UX-5B.3)', () => {
  it('copy serializes img tag with alt and title metadata', () => {
    const html = imageBlockToHtml(makeBlock('image', {
      src: 'https://example.com/a.png',
      alt: 'diagram',
      caption: 'Figure 1',
      width: 400,
    }));
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).toContain('alt="diagram"');
    expect(html).toContain('title="Figure 1|w:400"');
  });

  it('paste HTML img reconstructs image block', () => {
    const html = '<img src="https://x.com/p.png" alt="photo" title="Caption|w:300" />';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks[0].type).toBe('image');
    expect(blocks[0].src).toBe('https://x.com/p.png');
    expect(blocks[0].alt).toBe('photo');
    expect(blocks[0].caption).toBe('Caption');
    expect(blocks[0].width).toBe(300);
  });

  it('paste img wrapped in paragraph (Notion-style)', () => {
    const html = '<p><img src="https://n.com/i.jpg" alt="note" /></p>';
    const blocks = htmlDocumentToBlocks(html)!;
    expect(blocks[0].type).toBe('image');
    expect(blocks[0].src).toBe('https://n.com/i.jpg');
  });

  it('round-trip image metadata', () => {
    const original = makeBlock('image', {
      src: 'https://example.com/z.png',
      alt: 'z',
      caption: 'Cap',
    });
    const parsed = roundTrip([original]);
    expect(parsed[0].type).toBe('image');
    expect(parsed[0].src).toBe('https://example.com/z.png');
    expect(parsed[0].alt).toBe('z');
    expect(parsed[0].caption).toBe('Cap');
  });

  it('plain markdown image line paste', () => {
    const line = '![alt](https://img.io/a.png "cap|w:200")';
    const block = parseImageFromPlain(line)![0];
    expect(block.type).toBe('image');
    expect(block.caption).toBe('cap');
    expect(block.width).toBe(200);
  });
});

describe('callout block clipboard (UX-5B.3)', () => {
  it('copy serializes callout blockquote', () => {
    const html = blocksToCopyHtml([makeBlock('callout', { content: 'Important', calloutIcon: '💡' })]);
    expect(html).toContain('class="callout"');
    expect(html).toContain('data-callout-icon="💡"');
    expect(html).toContain('Important');
  });

  it('paste callout div', () => {
    const blocks = htmlDocumentToBlocks('<div class="callout" data-callout-icon="ℹ️">Important note</div>')!;
    expect(blocks[0].type).toBe('callout');
    expect(blocks[0].content).toBe('Important note');
    expect(blocks[0].calloutIcon).toBe('ℹ️');
  });

  it('paste GitHub alert blockquote', () => {
    const blocks = htmlDocumentToBlocks('<blockquote>[!NOTE] Important information</blockquote>')!;
    expect(blocks[0].type).toBe('callout');
    expect(blocks[0].content).toBe('Important information');
    expect(blocks[0].calloutIcon).toBe('ℹ️');
  });

  it('round-trip callout block', () => {
    const original = makeBlock('callout', { content: 'Watch out', calloutIcon: '⚠️' });
    const parsed = roundTrip([original]);
    expect(parsed[0].type).toBe('callout');
    expect(parsed[0].content).toBe('Watch out');
    expect(parsed[0].calloutIcon).toBe('⚠️');
  });
});
