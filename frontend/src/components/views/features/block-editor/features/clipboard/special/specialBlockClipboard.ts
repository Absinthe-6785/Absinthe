/**
 * specialBlockClipboard.ts — Code, math, image, callout clipboard helpers (UX-5B.3)
 */
import {
  formatImageTitle,
  makeBlock,
  parseImageTitle,
  type Block,
} from '../../../../../blockUtils';

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

const CALLOUT_ICONS: Record<string, string> = {
  NOTE: 'ℹ️',
  TIP: '💡',
  IMPORTANT: '❗',
  WARNING: '⚠️',
  CAUTION: '⚠️',
};

const LEADING_CALLOUT_EMOJI = /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}ℹ️❗⚠️💡])\s+(.+)$/u;

/** Extract language from class="language-ts" / hljs patterns. */
export function extractLanguageFromElement(el: Element | null): string {
  if (!el) return '';
  const dataLang = el.getAttribute('data-lang') ?? el.getAttribute('data-language');
  if (dataLang) return dataLang.trim();

  const cls = el.getAttribute('class') ?? '';
  const langMatch = cls.match(/(?:^|\s)language-([\w+#.-]+)/i)
    ?? cls.match(/(?:^|\s)lang-([\w+#.-]+)/i);
  return langMatch?.[1] ?? '';
}

export function codeBlockToHtml(block: Block): string {
  const lang = (block.language ?? '').trim();
  const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
  const code = escapeHtml(block.code ?? block.content ?? '');
  return `<pre${langClass}><code${langClass}>${code}</code></pre>`;
}

export function parseCodeFromPre(el: HTMLElement): Block {
  const codeEl = el.querySelector(':scope > code') ?? el.querySelector('code');
  const language = extractLanguageFromElement(codeEl) || extractLanguageFromElement(el);
  const code = codeEl?.textContent ?? el.textContent ?? '';
  return makeBlock('code', { code, language });
}

export function parseCodeFromCodeElement(el: HTMLElement): Block {
  const language = extractLanguageFromElement(el);
  return makeBlock('code', { code: el.textContent ?? '', language });
}

export function mathBlockToHtml(block: Block): string {
  const expr = block.math ?? block.content ?? '';
  const isBlock = block.mathBlock === true || expr.includes('\n');
  const escaped = escapeHtml(expr);
  const blockAttr = isBlock ? ' data-math-block="true"' : '';
  return `<span data-block-type="math"${blockAttr}>${escaped}</span>`;
}

export function parseMathElement(el: HTMLElement): Block {
  const isBlock = el.getAttribute('data-math-block') === 'true'
    || el.tagName.toUpperCase() === 'DIV';
  const math = el.textContent ?? '';
  return makeBlock('math', { math, mathBlock: isBlock });
}

export function imageBlockToHtml(block: Block): string {
  const src = block.src ?? '';
  if (!src) return '';
  const alt = block.alt ?? '';
  const title = formatImageTitle(block.caption, block.width);
  let attrs = `src="${escapeAttr(src)}"`;
  if (alt) attrs += ` alt="${escapeAttr(alt)}"`;
  if (title) attrs += ` title="${escapeAttr(title)}"`;
  return `<img ${attrs} />`;
}

export function parseImageElement(img: HTMLImageElement): Block {
  const src = img.getAttribute('src') ?? '';
  const alt = img.getAttribute('alt') ?? '';
  const titleRaw = img.getAttribute('title') ?? '';
  const { caption, width } = parseImageTitle(titleRaw);
  return makeBlock('image', {
    src,
    alt,
    ...(caption !== undefined ? { caption } : {}),
    ...(width !== undefined ? { width } : {}),
  });
}

export function calloutBlockToHtml(block: Block, inlineHtml: (content: string) => string): string {
  const icon = block.calloutIcon ?? 'ℹ️';
  const content = inlineHtml(block.content);
  return `<blockquote class="callout" data-callout-icon="${escapeAttr(icon)}">${content}</blockquote>`;
}

export function parseCalloutContent(raw: string): { icon: string; content: string } | null {
  const gh = raw.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i);
  if (gh) {
    return {
      icon: CALLOUT_ICONS[gh[1].toUpperCase()] ?? 'ℹ️',
      content: gh[2].trim(),
    };
  }
  const emoji = raw.match(LEADING_CALLOUT_EMOJI);
  if (emoji) {
    return { icon: emoji[1], content: emoji[2].trim() };
  }
  return null;
}

export function parseCalloutElement(el: HTMLElement, inlineText: (el: Element) => string): Block | null {
  const iconAttr = el.getAttribute('data-callout-icon');
  if (el.classList.contains('callout') || iconAttr) {
    return makeBlock('callout', {
      content: inlineText(el),
      calloutIcon: iconAttr ?? 'ℹ️',
    });
  }
  const parsed = parseCalloutContent(inlineText(el));
  if (parsed) {
    return makeBlock('callout', {
      content: parsed.content,
      calloutIcon: parsed.icon,
    });
  }
  return null;
}

/** Detect plain-text fenced code block for paste orchestrator. */
export function parseFencedCodeFromPlain(plain: string): Block[] | null {
  const trimmed = plain.trim();
  const match = trimmed.match(/^```([\w+#.-]*)\n([\s\S]*?)```$/);
  if (!match) return null;
  return [makeBlock('code', { language: match[1], code: match[2] })];
}

/** Detect plain-text display math $$...$$ (single or multi line). */
export function parseMathFromPlain(plain: string): Block[] | null {
  const trimmed = plain.trim();
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
    const inner = trimmed.slice(2, -2).trim();
    if (inner) {
      return [makeBlock('math', { math: inner, mathBlock: true })];
    }
  }
  return null;
}

/** Detect markdown image line ![alt](url). */
export function parseImageFromPlain(line: string): Block[] | null {
  const m = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!m) return null;
  let src = m[2];
  let caption: string | undefined;
  let width: number | undefined;
  const titleMatch = src.match(/^(\S.*?)\s+"([^"]*)"$/);
  if (titleMatch) {
    src = titleMatch[1];
    ({ caption, width } = parseImageTitle(titleMatch[2]));
  }
  return [makeBlock('image', {
    alt: m[1],
    src,
    ...(caption !== undefined ? { caption } : {}),
    ...(width !== undefined ? { width } : {}),
  })];
}
