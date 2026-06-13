import { markdownToBlocks, type Block } from './blockUtils';
import { HEADING_BLOCK_TYPES } from './features/block-editor/constants/blockEditorConstants';

const HEADING_FLASH_MS = 1200;

let cachedOutlineBody = '';
let cachedOutlineBlocks: Block[] | null = null;

function blocksForOutline(body: string): Block[] {
  if (body === cachedOutlineBody && cachedOutlineBlocks) return cachedOutlineBlocks;
  cachedOutlineBlocks = markdownToBlocks(body);
  cachedOutlineBody = body;
  return cachedOutlineBlocks;
}

/** Test-only: clear parsed-body cache between cases. */
export function clearOutlineBodyCache(): void {
  cachedOutlineBody = '';
  cachedOutlineBlocks = null;
}

function rootHeadingBlockId(blocks: Block[], headingIdx: number): string | null {
  let h = 0;
  for (const block of blocks) {
    if (HEADING_BLOCK_TYPES.includes(block.type)) {
      if (h === headingIdx) return block.id;
      h++;
    }
  }
  return null;
}

/** Resolve TOC index (extractTOC order) to a root-level heading block id. */
export function resolveHeadingBlockIdAtIndex(body: string, headingIdx: number): string | null {
  if (headingIdx < 0) return null;
  return rootHeadingBlockId(blocksForOutline(body), headingIdx);
}

export function resolveHeadingScrollTarget(
  body: string,
  headingIdx: number,
): { blockId: string | null; selector: string } {
  const blockId = resolveHeadingBlockIdAtIndex(body, headingIdx);
  return {
    blockId,
    selector: blockId ? `[data-block-id="${blockId}"]` : `[data-be-heading="${headingIdx}"]`,
  };
}

export function headingScrollSelector(body: string, headingIdx: number): string {
  return resolveHeadingScrollTarget(body, headingIdx).selector;
}

export function flashHeadingElement(el: Element): void {
  const block = el.closest('.be-block') ?? el;
  block.classList.add('be-heading-flash');
  window.setTimeout(() => block.classList.remove('be-heading-flash'), HEADING_FLASH_MS);
}

/** Scroll within the editor pane; falls back to document when the target is outside the pane. */
export function scrollToHeadingTarget(
  scrollRoot: HTMLElement | null,
  selector: string,
  onFlash?: (el: Element) => void,
): boolean {
  const scoped = scrollRoot?.querySelector(selector);
  const el = scoped ?? document.querySelector(selector);
  if (!el) return false;

  if (scoped && scrollRoot) {
    const rootRect = scrollRoot.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    scrollRoot.scrollTo({
      top: scrollRoot.scrollTop + (elRect.top - rootRect.top) - 12,
      behavior: 'smooth',
    });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onFlash?.(el);
  return true;
}

const HEADING_SCROLL_RETRY_MAX = 16;

function retryHeadingScroll(
  scrollRoot: HTMLElement | null,
  selector: string,
  onFlash?: (el: Element) => void,
): void {
  let attempts = 0;
  const tryScroll = () => {
    if (scrollToHeadingTarget(scrollRoot, selector, onFlash)) return;
    if (++attempts >= HEADING_SCROLL_RETRY_MAX) return;
    requestAnimationFrame(tryScroll);
  };
  requestAnimationFrame(tryScroll);
}

export interface NavigateToHeadingOptions {
  scrollRoot: HTMLElement | null;
  body: string;
  headingIdx: number;
  scrollToBlockId?: (blockId: string) => boolean;
  onFlash?: (el: Element) => void;
}

/**
 * Scroll the editor to a TOC heading. Uses virtual list scroll when the target
 * block is not mounted (root block virtualization).
 */
export function navigateToHeading(options: NavigateToHeadingOptions): boolean {
  const { scrollRoot, body, headingIdx, scrollToBlockId, onFlash } = options;
  const { blockId, selector } = resolveHeadingScrollTarget(body, headingIdx);

  if (scrollToHeadingTarget(scrollRoot, selector, onFlash)) return true;

  if (!blockId || !scrollToBlockId?.(blockId)) return false;

  scrollToBlockId(blockId);
  retryHeadingScroll(scrollRoot, selector, onFlash);
  return true;
}
