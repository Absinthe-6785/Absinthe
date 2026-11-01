// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecompressionStream as NodeDecompressionStream } from 'node:stream/web';
import JSZip from 'jszip';
import {
  clearDocxPreviewDocument,
  createContainedDocxElementFactory,
  DOCX_PREVIEW_CONTENT_ID,
  DOCX_PREVIEW_CSP,
  DOCX_PREVIEW_IFRAME_SANDBOX,
  DOCX_PREVIEW_SRC_DOC,
  DOCX_PREVIEW_STYLES_ID,
  DOCX_MAX_ARCHIVE_ENTRIES,
  DOCX_MAX_ENTRY_UNCOMPRESSED_BYTES,
  DOCX_MAX_TOTAL_UNCOMPRESSED_BYTES,
  isDocxArchiveWithinLimits,
  renderVerifiedDocxPreview,
  sanitizeDocxPreviewOutput,
} from './docxPreviewIsolation';

beforeEach(() => {
  // happy-dom omits the browser API; use Node's standards-compatible implementation for archive-bound tests.
  vi.stubGlobal('DecompressionStream', NodeDecompressionStream);
});

function createArchiveWithRepeatedEntryData(entryCount: number): Uint8Array {
  const name = new TextEncoder().encode('empty.bin');
  const emptyDeflateBlockCount = 8_192;
  const compressed = new Uint8Array(emptyDeflateBlockCount * 5);
  for (let index = 0; index < emptyDeflateBlockCount; index += 1) {
    const offset = index * 5;
    compressed[offset] = index === emptyDeflateBlockCount - 1 ? 1 : 0;
    compressed[offset + 1] = 0;
    compressed[offset + 2] = 0;
    compressed[offset + 3] = 0xff;
    compressed[offset + 4] = 0xff;
  }

  const local = new Uint8Array(30 + name.length + compressed.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(8, 8, true);
  localView.setUint32(18, compressed.length, true);
  localView.setUint16(26, name.length, true);
  local.set(name, 30);
  local.set(compressed, 30 + name.length);

  const centralEntryLength = 46 + name.length;
  const central = new Uint8Array(entryCount * centralEntryLength);
  for (let index = 0; index < entryCount; index += 1) {
    const offset = index * centralEntryLength;
    const view = new DataView(central.buffer, offset, centralEntryLength);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(10, 8, true);
    view.setUint32(20, compressed.length, true);
    view.setUint16(28, name.length, true);
    central.set(name, offset + 46);
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entryCount, true);
  endView.setUint16(10, entryCount, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length, true);

  const archive = new Uint8Array(local.length + central.length + end.length);
  archive.set(local);
  archive.set(central, local.length);
  archive.set(end, local.length + central.length);
  return archive;
}

describe('DOCX preview containment', () => {
  it('uses a script-free sandbox and a restrictive iframe-only CSP', () => {
    expect(DOCX_PREVIEW_IFRAME_SANDBOX).toBe('allow-same-origin');
    expect(DOCX_PREVIEW_CSP).toContain("default-src 'none'");
    expect(DOCX_PREVIEW_CSP).toContain("script-src 'none'");
    expect(DOCX_PREVIEW_CSP).toContain("connect-src 'none'");
    expect(DOCX_PREVIEW_CSP).toContain('img-src data:');
    expect(DOCX_PREVIEW_CSP).toContain("form-action 'none'");
    expect(DOCX_PREVIEW_SRC_DOC).toContain(DOCX_PREVIEW_CONTENT_ID);
    expect(DOCX_PREVIEW_SRC_DOC).toContain(DOCX_PREVIEW_STYLES_ID);
  });

  it('creates inert nodes in the supplied frame document and drops active tags and attributes', () => {
    const frameDocument = document.implementation.createHTMLDocument('frame');
    const make = createContainedDocxElementFactory(frameDocument);
    const output = make({
      tagName: 'div',
      onclick: 'alert(1)',
      children: [
        { tagName: 'script', children: ['alert(1)'] },
        { tagName: 'a', href: 'https://example.invalid', target: '_blank', children: ['external link'] },
        { tagName: 'table', children: [{ tagName: 'tbody', children: [{ tagName: 'tr', children: [{ tagName: 'td', children: ['cell'] }] }] }] },
      ],
    });
    const host = frameDocument.createElement('main');
    host.appendChild(output);

    expect(output.ownerDocument).toBe(frameDocument);
    expect(host.querySelector('script, a')).toBeNull();
    expect(host.querySelector('span')?.textContent).toContain('alert(1)');
    expect(host.querySelector('table tbody td')?.textContent).toBe('cell');
    expect(host.querySelector('[onclick], [href], [target]')).toBeNull();
  });

  it('removes active output, external links/resources and event attributes while retaining safe image data', () => {
    const content = document.createElement('main');
    const styles = document.createElement('div');
    content.innerHTML = '<script>alert(1)</script><iframe src="https://example.invalid"></iframe><a href="https://example.invalid" onclick="x()">link</a><img src="https://example.invalid/a.png" onerror="x()"><img src="data:image/png;base64,AA==">';
    styles.innerHTML = '<style>@import url(https://example.invalid/a.css); .x { background: url(https://example.invalid/x); }</style>';

    sanitizeDocxPreviewOutput(content, styles);

    expect(content.querySelector('script, iframe, a')).toBeNull();
    expect(content.querySelectorAll('img')).toHaveLength(1);
    expect(content.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AA==');
    expect(content.querySelector('[onclick], [onerror], [href]')).toBeNull();
    expect(styles.textContent).not.toContain('https://');
  });

  it('clears rendered content without revoking unrelated application blob URLs', () => {
    const frameDocument = document.implementation.createHTMLDocument('frame');
    const styles = frameDocument.createElement('div');
    styles.id = DOCX_PREVIEW_STYLES_ID;
    styles.innerHTML = '<style>.x { background: url(blob:preview-resource); }</style>';
    const content = frameDocument.createElement('main');
    content.id = DOCX_PREVIEW_CONTENT_ID;
    content.innerHTML = '<img src="blob:preview-image"><p>rendered content</p>';
    frameDocument.body.append(styles, content);
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    clearDocxPreviewDocument(frameDocument);

    expect(content.childNodes).toHaveLength(0);
    expect(styles.childNodes).toHaveLength(0);
    expect(revoke).not.toHaveBeenCalled();
  });

  it('renders a real minimal DOCX into the supplied document and keeps its external hyperlink inert', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>`);
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/" TargetMode="External"/>
      </Relationships>`);
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:body><w:p><w:r><w:t>Verified DOCX text</w:t></w:r><w:hyperlink r:id="rIdLink"><w:r><w:t> external destination</w:t></w:r></w:hyperlink></w:p>
          <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
        </w:body>
      </w:document>`);
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const file = new File([bytes], 'sample.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    expect(await isDocxArchiveWithinLimits(file)).toBe(true);
    const frameDocument = document.implementation.createHTMLDocument('frame');
    const styles = frameDocument.createElement('div');
    styles.id = DOCX_PREVIEW_STYLES_ID;
    const content = frameDocument.createElement('main');
    content.id = DOCX_PREVIEW_CONTENT_ID;
    frameDocument.body.append(styles, content);

    await expect(renderVerifiedDocxPreview(file, frameDocument, () => true)).resolves.toBe(true);

    expect(content.textContent).toContain('Verified DOCX text');
    expect(content.textContent).toContain('external destination');
    expect(content.querySelector('a[href], iframe, script')).toBeNull();
    expect(styles.textContent).not.toContain('https://example.invalid');
  });

  it('rejects declared decompression size, total size and entry count above the preview budget', async () => {
    const expansionZip = new JSZip();
    expansionZip.file('word/document.xml', 'x'.repeat(DOCX_MAX_ENTRY_UNCOMPRESSED_BYTES + 1));
    const expandedBytes = await expansionZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const expandedFile = new File([expandedBytes], 'expanded.docx');
    expect(expandedFile.size).toBeLessThan(DOCX_MAX_ENTRY_UNCOMPRESSED_BYTES);
    expect(await isDocxArchiveWithinLimits(expandedFile)).toBe(false);

    const totalZip = new JSZip();
    const aggregateEntryBytes = Math.floor(DOCX_MAX_TOTAL_UNCOMPRESSED_BYTES / 5) + 1;
    for (let index = 0; index < 5; index += 1) totalZip.file(`part-${index}.xml`, 'x'.repeat(aggregateEntryBytes));
    const totalBytes = await totalZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    expect(await isDocxArchiveWithinLimits(new File([totalBytes], 'aggregate.docx'))).toBe(false);

    const manyEntriesZip = new JSZip();
    for (let index = 0; index <= DOCX_MAX_ARCHIVE_ENTRIES; index += 1) manyEntriesZip.file(`entry-${index}.xml`, 'x');
    const manyEntriesBytes = await manyEntriesZip.generateAsync({ type: 'uint8array' });
    expect(await isDocxArchiveWithinLimits(new File([manyEntriesBytes], 'many-entries.docx'))).toBe(false);
  });

  it('counts actual streamed output and rejects a ZIP whose headers understate expansion', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', 'decompressed bytes exceed the forged size');
    const generated = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const forged = generated.slice();
    const view = new DataView(forged.buffer, forged.byteOffset, forged.byteLength);
    let endRecord = -1;
    for (let offset = forged.byteLength - 22; offset >= Math.max(0, forged.byteLength - 22 - 0xffff); offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50
        && offset + 22 + view.getUint16(offset + 20, true) === forged.byteLength) {
        endRecord = offset;
        break;
      }
    }
    expect(endRecord).toBeGreaterThanOrEqual(0);
    const centralOffset = view.getUint32(endRecord + 16, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    view.setUint32(centralOffset + 24, 1, true);
    view.setUint32(localOffset + 22, 1, true);

    expect(await isDocxArchiveWithinLimits(new File([forged], 'understated-size.docx'))).toBe(false);
  });

  it('bounds repeated processing of overlapping compressed entry data', async () => {
    const original = NodeDecompressionStream;
    const createStream = vi.fn();
    class CountingDecompressionStream extends original {
      constructor(format: CompressionFormat) {
        super(format);
        createStream();
      }
    }
    vi.stubGlobal('DecompressionStream', CountingDecompressionStream);
    const archive = createArchiveWithRepeatedEntryData(2);

    expect(2 * 8_192 * 5).toBeGreaterThan(archive.byteLength);
    expect(await isDocxArchiveWithinLimits(new File([archive], 'overlapping-entries.docx'))).toBe(false);
    expect(createStream).toHaveBeenCalledOnce();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
