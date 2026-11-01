import type { HElement, Options } from 'docx-preview';

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';

export const DOCX_PREVIEW_IFRAME_SANDBOX = 'allow-same-origin';
export const DOCX_PREVIEW_CONTENT_ID = 'absinthe-docx-preview-content';
export const DOCX_PREVIEW_STYLES_ID = 'absinthe-docx-preview-styles';

export const DOCX_PREVIEW_CSP = [
  "default-src 'none'",
  'img-src data:',
  "font-src 'none'",
  "style-src 'unsafe-inline'",
  "script-src 'none'",
  "connect-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "object-src 'none'",
  "media-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

export const DOCX_MAX_ARCHIVE_ENTRIES = 2_048;
export const DOCX_MAX_ENTRY_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;
export const DOCX_MAX_TOTAL_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const DOCX_MAX_CENTRAL_DIRECTORY_BYTES = 1024 * 1024;

export const DOCX_PREVIEW_SRC_DOC = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${DOCX_PREVIEW_CSP}"><meta charset="utf-8"></head><body><div id="${DOCX_PREVIEW_STYLES_ID}"></div><main id="${DOCX_PREVIEW_CONTENT_ID}"></main></body></html>`;

/**
 * Reject oversized ZIP manifests before docx-preview asks JSZip to expand XML
 * or images. The local-original readback already bounds the compressed File;
 * these limits separately bound entry count and declared expansion.
 */
export async function isDocxArchiveWithinLimits(file: File, isCurrent: () => boolean = () => true): Promise<boolean> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isCurrent()) return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endOfSearch = Math.max(0, bytes.byteLength - 22 - 0xffff);
    let endRecord = -1;
    for (let offset = bytes.byteLength - 22; offset >= endOfSearch; offset -= 1) {
      if (offset < 0 || view.getUint32(offset, true) !== 0x06054b50) continue;
      const commentLength = view.getUint16(offset + 20, true);
      if (offset + 22 + commentLength === bytes.byteLength) {
        endRecord = offset;
        break;
      }
    }
    if (endRecord < 0) return false;

    const disk = view.getUint16(endRecord + 4, true);
    const centralDirectoryDisk = view.getUint16(endRecord + 6, true);
    const entriesOnDisk = view.getUint16(endRecord + 8, true);
    const entryCount = view.getUint16(endRecord + 10, true);
    const centralDirectorySize = view.getUint32(endRecord + 12, true);
    const centralDirectoryOffset = view.getUint32(endRecord + 16, true);
    if (disk !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount
      || entryCount === 0 || entryCount === 0xffff || entryCount > DOCX_MAX_ARCHIVE_ENTRIES
      || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff
      || centralDirectorySize > DOCX_MAX_CENTRAL_DIRECTORY_BYTES) return false;

    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
    if (centralDirectoryEnd !== endRecord || centralDirectoryEnd > bytes.byteLength) return false;

    let offset = centralDirectoryOffset;
    let declaredTotalUncompressedBytes = 0;
    let actualTotalUncompressedBytes = 0;
    let totalCompressedBytesProcessed = 0;
    for (let index = 0; index < entryCount; index += 1) {
      if (offset + 46 > centralDirectoryEnd || view.getUint32(offset, true) !== 0x02014b50) return false;
      const flags = view.getUint16(offset + 8, true);
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const diskStart = view.getUint16(offset + 34, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const centralEntryEnd = offset + 46 + nameLength + extraLength + commentLength;
      if (centralEntryEnd > centralDirectoryEnd || diskStart !== 0 || compressedSize === 0xffffffff
        || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff
        || (flags & 0x0001) !== 0 || (method !== 0 && method !== 8)
        || uncompressedSize > DOCX_MAX_ENTRY_UNCOMPRESSED_BYTES) return false;

      // Repeated/overlapping central entries must not amplify decompression work beyond the archive size.
      totalCompressedBytesProcessed += compressedSize;
      if (!Number.isSafeInteger(totalCompressedBytesProcessed) || totalCompressedBytesProcessed > bytes.byteLength) return false;

      declaredTotalUncompressedBytes += uncompressedSize;
      if (!Number.isSafeInteger(declaredTotalUncompressedBytes)
        || declaredTotalUncompressedBytes > DOCX_MAX_TOTAL_UNCOMPRESSED_BYTES) return false;

      if (localHeaderOffset + 30 > centralDirectoryOffset || view.getUint32(localHeaderOffset, true) !== 0x04034b50) return false;
      const localFlags = view.getUint16(localHeaderOffset + 6, true);
      const localMethod = view.getUint16(localHeaderOffset + 8, true);
      const localCompressedSize = view.getUint32(localHeaderOffset + 18, true);
      const localUncompressedSize = view.getUint32(localHeaderOffset + 22, true);
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const compressedDataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      if (localFlags !== flags || localMethod !== method
        || ((flags & 0x0008) === 0 && (localCompressedSize !== compressedSize || localUncompressedSize !== uncompressedSize))
        || compressedDataOffset + compressedSize > centralDirectoryOffset) return false;

      if (!isCurrent()) return false;
      let actualUncompressedBytes = 0;
      if (method === 0) {
        actualUncompressedBytes = compressedSize;
      } else {
        if (typeof DecompressionStream === 'undefined') return false;
        const compressedBlob = new Blob([bytes.subarray(compressedDataOffset, compressedDataOffset + compressedSize)]);
        const decompressed = compressedBlob.stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const reader = decompressed.getReader();
        try {
          while (true) {
            if (!isCurrent()) {
              await reader.cancel();
              return false;
            }
            const result = await reader.read();
            if (result.done) break;
            actualUncompressedBytes += result.value.byteLength;
            actualTotalUncompressedBytes += result.value.byteLength;
            if (!Number.isSafeInteger(actualUncompressedBytes) || actualUncompressedBytes > DOCX_MAX_ENTRY_UNCOMPRESSED_BYTES
              || !Number.isSafeInteger(actualTotalUncompressedBytes)
              || actualTotalUncompressedBytes > DOCX_MAX_TOTAL_UNCOMPRESSED_BYTES) {
              await reader.cancel();
              return false;
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
      if (actualUncompressedBytes !== uncompressedSize) return false;
      if (method === 0) actualTotalUncompressedBytes += actualUncompressedBytes;
      if (!Number.isSafeInteger(actualTotalUncompressedBytes)
        || actualTotalUncompressedBytes > DOCX_MAX_TOTAL_UNCOMPRESSED_BYTES) return false;

      offset = centralEntryEnd;
    }
    return offset === centralDirectoryEnd;
  } catch {
    return false;
  }
}

const HTML_TAGS = new Set([
  'article', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup', 'dd', 'del', 'div', 'dl', 'dt',
  'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'li', 'ol', 'p', 'pre', 's',
  'section', 'span', 'strike', 'strong', 'style', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
  'thead', 'tr', 'u', 'ul', 'wbr',
]);
const SVG_TAGS = new Set([
  'circle', 'defs', 'ellipse', 'g', 'image', 'line', 'path', 'polygon', 'polyline', 'rect', 'svg', 'text', 'tspan',
]);
const MATHML_TAGS = new Set([
  'mi', 'mn', 'mo', 'mover', 'mroot', 'mrow', 'ms', 'msqrt', 'msub', 'msubsup', 'msup', 'mtable', 'mtd', 'mtr',
  'munder', 'munderover',
]);
const SAFE_RASTER_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,[a-z0-9+/]+=*$/i;
const ACTIVE_TAGS = new Set(['base', 'button', 'embed', 'form', 'iframe', 'input', 'link', 'object', 'script', 'source', 'video', 'audio']);
const ACTIVE_ATTRIBUTES = new Set([
  'action', 'formaction', 'poster', 'srcdoc', 'srcset', 'target', 'download', 'xlink:href',
]);

function cleanCss(value: string): string {
  return value
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/url\s*\([^)]*\)/gi, 'none')
    .replace(/expression\s*\([^)]*\)/gi, 'none')
    .replace(/(?:-moz-binding|behavior)\s*:[^;{}]*/gi, '');
}

function cssPropertyName(name: string): string {
  return name.startsWith('--') ? name : name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

function isDomNode(value: unknown): value is Node {
  return !!value && typeof value === 'object' && typeof (value as { nodeType?: unknown }).nodeType === 'number';
}

function safeInteger(value: unknown, minimum: number, maximum: number): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
}

/**
 * The renderer's default h() uses the parent window's global document and copies
 * arbitrary properties onto elements. Build every node in the isolated frame
 * document instead, and allow only the passive elements the renderer needs.
 */
export function createContainedDocxElementFactory(doc: Document): Options['h'] {
  const ownedNodes = new WeakSet<Node>();
  const remember = <T extends Node>(node: T): T => {
    ownedNodes.add(node);
    return node;
  };

  const setStyle = (element: Element, style: HElement['style']): void => {
    if (typeof style === 'string') {
      const safe = cleanCss(style);
      if (safe) element.setAttribute('style', safe);
      return;
    }
    if (!style || typeof style !== 'object') return;
    const declaration = (element as Element & { style?: CSSStyleDeclaration }).style;
    if (!declaration) return;
    for (const [name, rawValue] of Object.entries(style)) {
      if (!/^(?:--[a-z0-9-]+|[a-z][a-z0-9-]*)$/i.test(name) || typeof rawValue !== 'string') continue;
      const value = cleanCss(rawValue);
      if (value) declaration.setProperty(cssPropertyName(name), value);
    }
  };

  const createFromElement = (input: HElement): Node => {
    const requestedTag = typeof input.tagName === 'string' ? input.tagName.toLowerCase() : '';
    if (requestedTag === '#fragment') {
      const fragment = remember(doc.createDocumentFragment());
      for (const child of input.children ?? []) fragment.appendChild(create(child));
      return fragment;
    }
    if (requestedTag === '#comment') return remember(doc.createComment('DOCX preview comment'));

    let namespace = input.ns ?? HTML_NAMESPACE;
    let tagName = requestedTag;
    if (namespace === SVG_NAMESPACE) {
      if (!SVG_TAGS.has(tagName)) tagName = 'g';
    } else if (namespace === MATHML_NAMESPACE) {
      if (!MATHML_TAGS.has(tagName)) tagName = 'mrow';
    } else {
      namespace = HTML_NAMESPACE;
      if (tagName === 'a' || !HTML_TAGS.has(tagName)) tagName = 'span';
    }

    const element = namespace === HTML_NAMESPACE
      ? doc.createElement(tagName)
      : doc.createElementNS(namespace, tagName);
    remember(element);

    if (typeof input.className === 'string') {
      element.setAttribute('class', input.className.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 512));
    }
    setStyle(element, input.style);

    const props = input as Record<string, unknown>;
    if (typeof props.lang === 'string' && /^[a-z0-9-]{1,35}$/i.test(props.lang)) element.setAttribute('lang', props.lang);
    if (typeof props.id === 'string' && props.id.length <= 256 && !/[\u0000-\u001f\u007f]/.test(props.id)) {
      element.setAttribute('id', props.id);
    }
    const colSpan = safeInteger(props.colSpan, 1, 1000);
    const rowSpan = safeInteger(props.rowSpan, 1, 1000);
    const start = safeInteger(props.start, 1, 1_000_000);
    if (colSpan !== null) (element as HTMLTableCellElement).colSpan = colSpan;
    if (rowSpan !== null) (element as HTMLTableCellElement).rowSpan = rowSpan;
    if (start !== null) (element as HTMLOListElement).start = start;

    for (const child of input.children ?? []) element.appendChild(create(child));
    return element;
  };

  const cloneNode = (node: Node): Node => {
    if (ownedNodes.has(node)) return node;
    if (node.nodeType === 3) return remember(doc.createTextNode(node.textContent ?? ''));
    if (node.nodeType === 8) return remember(doc.createComment('DOCX preview comment'));
    if (node.nodeType === 11) {
      const fragment = remember(doc.createDocumentFragment());
      for (const child of Array.from(node.childNodes)) fragment.appendChild(cloneNode(child));
      return fragment;
    }
    if (node.nodeType === 1) {
      const source = node as Element;
      const props: Record<string, unknown> = {};
      for (const name of ['id', 'lang', 'colSpan', 'rowSpan', 'start']) {
        const value = source.getAttribute(name);
        if (value !== null) props[name] = value;
      }
      return createFromElement({
        ns: source.namespaceURI ?? HTML_NAMESPACE,
        tagName: source.localName,
        className: source.getAttribute('class') ?? undefined,
        style: source.getAttribute('style') ?? undefined,
        children: Array.from(source.childNodes),
        ...props,
      });
    }
    return remember(doc.createTextNode(node.textContent ?? ''));
  };

  const create = (input: Parameters<Options['h']>[0]): Node => {
    if (typeof input === 'string') return remember(doc.createTextNode(input));
    if (isDomNode(input)) return cloneNode(input);
    if (!input || typeof input !== 'object') return remember(doc.createTextNode(''));
    return createFromElement(input as HElement);
  };

  return create;
}

export function sanitizeDocxPreviewOutput(content: HTMLElement, styles: HTMLElement): void {
  for (const root of [content, styles]) {
    for (const element of Array.from(root.querySelectorAll('*'))) {
      const tagName = element.localName.toLowerCase();
      if (ACTIVE_TAGS.has(tagName)) {
        element.remove();
        continue;
      }
      if (tagName === 'a') {
        const inert = element.ownerDocument.createElement('span');
        const className = element.getAttribute('class');
        const style = element.getAttribute('style');
        if (className) inert.setAttribute('class', className);
        if (style) {
          const safeStyle = cleanCss(style);
          if (safeStyle) inert.setAttribute('style', safeStyle);
        }
        while (element.firstChild) inert.appendChild(element.firstChild);
        element.replaceWith(inert);
        continue;
      }
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();
        if (name.startsWith('on') || ACTIVE_ATTRIBUTES.has(name)) {
          element.removeAttribute(attribute.name);
        } else if (name === 'href' || name === 'src' || name === 'xlink:href') {
          const isInternalRaster = SAFE_RASTER_DATA_IMAGE.test(value);
          const isImageReference = tagName === 'img' || (tagName === 'image' && element.namespaceURI === SVG_NAMESPACE);
          if (!isInternalRaster || !isImageReference) element.removeAttribute(attribute.name);
        } else if (name === 'style') {
          const safe = cleanCss(value);
          if (safe) element.setAttribute('style', safe);
          else element.removeAttribute('style');
        }
      }
      if ((tagName === 'img' || (tagName === 'image' && element.namespaceURI === SVG_NAMESPACE))
        && !SAFE_RASTER_DATA_IMAGE.test(element.getAttribute('src') ?? element.getAttribute('href') ?? '')) {
        element.remove();
        continue;
      }
      if (tagName === 'style') element.textContent = cleanCss(element.textContent ?? '');
    }
  }
}

export function clearDocxPreviewContainers(content: HTMLElement | null, styles: HTMLElement | null): void {
  if (!content || !styles) return;
  content.replaceChildren();
  styles.replaceChildren();
}

export function clearDocxPreviewDocument(doc: Document | null | undefined): void {
  if (!doc) return;
  clearDocxPreviewContainers(
    doc.getElementById(DOCX_PREVIEW_CONTENT_ID),
    doc.getElementById(DOCX_PREVIEW_STYLES_ID),
  );
}

export async function renderVerifiedDocxPreview(
  file: File,
  doc: Document,
  isCurrent: () => boolean,
): Promise<boolean> {
  const content = doc.getElementById(DOCX_PREVIEW_CONTENT_ID);
  const styles = doc.getElementById(DOCX_PREVIEW_STYLES_ID);
  if (!content || !styles) throw new Error('DOCX preview frame is not ready');
  const clear = () => clearDocxPreviewContainers(content, styles);
  if (!isCurrent()) return false;
  try {
    const { renderAsync } = await import('docx-preview');
    if (!isCurrent()) {
      clear();
      return false;
    }
    await renderAsync(file, content, styles, {
      renderAltChunks: false,
      renderComments: false,
      ignoreFonts: true,
      useBase64URL: true,
      experimental: false,
      debug: false,
      h: createContainedDocxElementFactory(doc),
    });
    if (!isCurrent()) {
      clear();
      return false;
    }
    sanitizeDocxPreviewOutput(content, styles);
    return true;
  } catch (error) {
    clear();
    throw error;
  }
}
