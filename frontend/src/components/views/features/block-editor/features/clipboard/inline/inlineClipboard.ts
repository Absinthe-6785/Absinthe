/**
 * inlineClipboard.ts — Rich inline HTML ↔ markdown for clipboard (UX-5B.2)
 *
 * Converts between editor markdown content and semantic HTML for copy/paste
 * with external editors (Google Docs, Notion, Word, AI tools).
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

/** Markdown inline syntax → semantic HTML for clipboard copy. */
export function markdownInlineToHtml(text: string): string {
  if (!text) return '';

  const placeholders: { token: string; html: string }[] = [];
  let phIndex = 0;

  const stash = (html: string): string => {
    const token = `\u0000PH${phIndex++}\u0000`;
    placeholders.push({ token, html });
    return token;
  };

  let work = text;
  work = work.replace(/\[\[(.+?)\]\]/g, (_m, title: string) =>
    stash(`<a href="#">${escapeHtml(title)}</a>`));
  work = work.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) =>
    stash(`<a href="${escapeAttr(url)}">${escapeHtml(label)}</a>`));

  let html = escapeHtml(work)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (const { token, html: phHtml } of placeholders) {
    html = html.split(token).join(phHtml);
  }
  return html;
}

function wrapMarkdown(marker: string, inner: string): string {
  return inner ? `${marker}${inner}${marker}` : inner;
}

function styleFlags(el: HTMLElement): { bold: boolean; italic: boolean; underline: boolean } {
  const style = (el.getAttribute('style') ?? '').toLowerCase();
  const weight = style.match(/font-weight:\s*([^;]+)/)?.[1]?.trim() ?? '';
  const fontStyle = style.match(/font-style:\s*([^;]+)/)?.[1]?.trim() ?? '';
  const deco = style.match(/text-decoration(?:-line)?:\s*([^;]+)/)?.[1]?.trim() ?? '';
  const bold = weight === 'bold' || weight === '700' || weight === '600' || Number(weight) >= 600;
  const italic = fontStyle === 'italic' || fontStyle === 'oblique';
  const underline = deco.includes('underline');
  return { bold, italic, underline };
}

function applyStyleFlags(text: string, flags: { bold: boolean; italic: boolean; underline: boolean }): string {
  let out = text;
  if (flags.underline) out = wrapMarkdown('++', out);
  if (flags.italic) out = wrapMarkdown('*', out);
  if (flags.bold) out = wrapMarkdown('**', out);
  return out;
}

/** Walk inline DOM nodes → markdown string. */
function inlineNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').replace(/\u00a0/g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  const inner = Array.from(el.childNodes).map(inlineNodeToMarkdown).join('');

  switch (tag) {
    case 'STRONG':
    case 'B':
      return wrapMarkdown('**', inner);
    case 'EM':
    case 'I':
      return wrapMarkdown('*', inner);
    case 'U':
      return wrapMarkdown('++', inner);
    case 'CODE':
      return inner.includes('`') ? inner : `\`${inner}\``;
    case 'A': {
      const href = (el.getAttribute('href') ?? '').trim();
      if (!href || href === '#') return `[[${inner}]]`;
      return `[${inner}](${href})`;
    }
    case 'BR':
      return '\n';
    case 'SPAN': {
      const flags = styleFlags(el);
      if (flags.bold || flags.italic || flags.underline) {
        return applyStyleFlags(inner, flags);
      }
      return inner;
    }
    case 'FONT': {
      const flags = styleFlags(el);
      return flags.bold || flags.italic || flags.underline
        ? applyStyleFlags(inner, flags)
        : inner;
    }
    default:
      return inner;
  }
}

/** Element text content with inline HTML → markdown (bold, italic, underline, code, links). */
export function elementInlineToMarkdown(el: Element): string {
  const raw = Array.from(el.childNodes).map(inlineNodeToMarkdown).join('');
  return raw.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').trim();
}

/** Plain-text fallback when no element wrapper exists. */
export function inlineTextToMarkdown(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
