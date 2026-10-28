type InlineTagRenderer = (tag: string) => string;

const INLINE_TAG_PATTERN_SOURCE = String.raw`(^|[^\p{L}\p{N}\p{M}_#\-\^])#([\p{L}\p{N}_][\p{L}\p{N}\p{M}_-]*)`;

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function isProtectedElement(name: string, token: string): boolean {
  if (['code', 'pre', 'kbd', 'samp', 'script', 'style'].includes(name)) return true;
  const classes = token.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2]?.split(/\s+/) ?? [];
  return classes.some(className =>
    className === 'katex'
    || className.startsWith('be-wikilink')
    || className.startsWith('be-wiki-chip')
    || className === 'bwl'
    || className === 'bwlm'
    || className === 'be-footnote-ref'
    || className.startsWith('be-math-')
    || className.startsWith('be-live-math-')
    || className.startsWith('bmath'),
  );
}

function escapeTagAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function extractInlineTagNames(text: string): string[] {
  return [...text.matchAll(new RegExp(INLINE_TAG_PATTERN_SOURCE, 'gu'))].map(match => match[2]);
}

/** Render inline tags in HTML text nodes while leaving code and math subtrees untouched. */
export function renderInlineTagsInHtml(html: string, renderTag: InlineTagRenderer): string {
  const pieces = html.match(/<[^>]*>|[^<]+/g) ?? [];
  const stack: Array<{ name: string; protected: boolean }> = [];
  let protectedDepth = 0;

  return pieces.map(piece => {
    if (!piece.startsWith('<')) {
      if (protectedDepth > 0) return piece;
      return piece.replace(
        new RegExp(INLINE_TAG_PATTERN_SOURCE, 'gu'),
        (_match, boundary: string, tag: string) => `${boundary}${renderTag(tag)}`,
      );
    }

    const match = piece.match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b/i);
    if (!match) return piece;
    const [, closing, rawName] = match;
    const name = rawName.toLowerCase();
    if (closing) {
      let index = stack.length - 1;
      while (index >= 0 && stack[index].name !== name) index -= 1;
      if (index >= 0) {
        for (let pop = stack.length - 1; pop >= index; pop -= 1) {
          if (stack[pop].protected) protectedDepth -= 1;
        }
        stack.length = index;
      }
      return piece;
    }

    if (!piece.endsWith('/>') && !VOID_ELEMENTS.has(name)) {
      const protectedElement = isProtectedElement(name, piece);
      stack.push({ name, protected: protectedElement });
      if (protectedElement) protectedDepth += 1;
    }
    return piece;
  }).join('');
}

export function inlineTagSpan(tag: string, className: string, style = ''): string {
  const safe = escapeTagAttribute(tag);
  const styleAttr = style ? ` style="${style}"` : '';
  return `<span class="${className}" data-tag="${safe}"${styleAttr}>#${safe}</span>`;
}
