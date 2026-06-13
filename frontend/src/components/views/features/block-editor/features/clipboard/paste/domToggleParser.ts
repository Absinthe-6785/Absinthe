/**
 * domToggleParser.ts — Recover toggle blocks from editor DOM clipboard HTML (UX-5B.1)
 *
 * When semantic copy fails, Chromium may place `.be-toggle-wrap` HTML on the clipboard.
 */
import { makeBlock, type Block, type BlockType } from '../../../../../blockUtils';
import { elementInlineToMarkdown } from '../inline/inlineClipboard';
import {
  isToggleHeadingBlockType,
  toggleHeadingBlockType,
} from '../../../../../toggleBlockTypes';

function inlineText(el: Element): string {
  return elementInlineToMarkdown(el);
}

export function isDomToggleHtml(html: string): boolean {
  return /\bbe-toggle-wrap\b/i.test(html);
}

const HEADING_TAGS: Record<string, 'heading1' | 'heading2' | 'heading3' | 'heading4'> = {
  H1: 'heading1',
  H2: 'heading2',
  H3: 'heading3',
  H4: 'heading4',
};

const HEADING_LEVEL: Record<string, 1 | 2 | 3 | 4> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
};

function resolveToggleBlockType(wrap: HTMLElement, headerEl: HTMLElement | null): BlockType {
  const dataType = headerEl?.getAttribute('data-block-type')
    ?? wrap.querySelector('.be-toggle-header-block [data-block-type]')?.getAttribute('data-block-type');
  if (dataType && isToggleHeadingBlockType(dataType as BlockType)) {
    return dataType as BlockType;
  }
  for (const tag of ['H1', 'H2', 'H3', 'H4'] as const) {
    if (wrap.querySelector(`.be-toggle-header-block ${tag.toLowerCase()}`)) {
      return toggleHeadingBlockType(HEADING_LEVEL[tag]);
    }
  }
  return 'toggle';
}

function parseTypedBlock(type: string, content: string): Block | null {
  if (!content && type !== 'divider') return null;
  switch (type) {
    case 'paragraph':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'quote':
    case 'bullet':
    case 'numbered':
    case 'code':
    case 'callout':
      return makeBlock(type as BlockType, { content });
    case 'todo': {
      const checked = /^\[x\]/i.test(content);
      const stripped = content.replace(/^\[[ x]\]\s*/i, '');
      return makeBlock('todo', { content: stripped, checked });
    }
    default:
      return null;
  }
}

function parseBeBlockElement(blockEl: HTMLElement): Block | null {
  const nestedWrap = blockEl.querySelector(':scope > .be-content .be-toggle-wrap, :scope > .be-toggle-wrap');
  if (nestedWrap instanceof HTMLElement) {
    return parseBeToggleWrap(nestedWrap);
  }

  const typedEl = blockEl.querySelector('[data-block-type]') as HTMLElement | null;
  if (typedEl) {
    const type = typedEl.getAttribute('data-block-type') ?? 'paragraph';
    const parsed = parseTypedBlock(type, inlineText(typedEl));
    if (parsed) {
      if (type === 'bullet' || type === 'numbered') {
        const pad = blockEl.querySelector('[style*="padding-left"]');
        if (pad) {
          const px = parseInt(pad.getAttribute('style')?.match(/padding-left:\s*(\d+)px/)?.[1] ?? '0', 10);
          parsed.indent = Math.floor(px / 24);
        }
      }
      return parsed;
    }
  }

  for (const tag of ['H1', 'H2', 'H3'] as const) {
    const heading = blockEl.querySelector(tag.toLowerCase());
    if (heading) {
      const content = inlineText(heading);
      if (content) return makeBlock(HEADING_TAGS[tag], { content });
    }
  }

  const flex = blockEl.querySelector('div[style*="display"][style*="flex"], div[style*="display: flex"]');
  if (flex) {
    const marker = flex.querySelector('span')?.textContent?.trim() ?? '';
    const editable = flex.querySelector('.be-editable, .be-block-text') as HTMLElement | null;
    const content = editable ? inlineText(editable) : '';
    if (content) {
      if (marker === '•' || marker === '·' || marker === '-') {
        return makeBlock('bullet', { content });
      }
      if (/^\d+\.$/.test(marker)) {
        return makeBlock('numbered', {
          content,
          listIndex: Number(marker.replace('.', '')),
        });
      }
    }
  }

  const editable = blockEl.querySelector('.be-editable, .be-block-text, p') as HTMLElement | null;
  if (editable) {
    const content = inlineText(editable);
    if (content) return makeBlock('paragraph', { content });
  }

  const fallback = inlineText(blockEl);
  return fallback ? makeBlock('paragraph', { content: fallback }) : null;
}

/** Parse one `.be-toggle-wrap` element into a toggle block. */
export function parseBeToggleWrap(wrap: HTMLElement): Block | null {
  const headerEl = wrap.querySelector(
    '.be-toggle-header-block .be-editable, .be-toggle-header-block .be-block-text, .be-toggle-header-block [data-block-type="toggle"]',
  ) as HTMLElement | null;
  const headerContent = headerEl ? inlineText(headerEl) : inlineText(
    wrap.querySelector('.be-toggle-header-block') ?? wrap,
  );
  if (!headerContent) return null;

  const childrenWrap = wrap.querySelector(':scope > .be-toggle-children');
  const children: Block[] = [];
  if (childrenWrap) {
    childrenWrap.querySelectorAll(':scope > .be-block').forEach(childEl => {
      if (!(childEl instanceof HTMLElement)) return;
      const block = parseBeBlockElement(childEl);
      if (block) children.push(block);
    });
  }

  return makeBlock(resolveToggleBlockType(wrap, headerEl), { content: headerContent, children, collapsed: false });
}

/** Collect top-level `.be-toggle-wrap` blocks from HTML (for tests / pre-check). */
export function htmlDomToggleToBlocks(html: string): Block[] | null {
  if (!html.trim() || typeof DOMParser === 'undefined') return null;
  if (!isDomToggleHtml(html)) return null;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: Block[] = [];

  const collectToggles = (parent: ParentNode) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as HTMLElement;
      if (el.classList.contains('be-toggle-wrap')) {
        const toggle = parseBeToggleWrap(el);
        if (toggle) blocks.push(toggle);
      } else {
        collectToggles(el);
      }
    }
  };

  collectToggles(doc.body);
  return blocks.length > 0 ? blocks : null;
}
