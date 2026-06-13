import type { Block } from './blockUtils';
import { isToggleBlockType, toggleHeadingLevel } from './toggleBlockTypes';
import { HEADING_BLOCK_TYPES } from './features/block-editor/constants/blockEditorConstants';
import type { TocItem } from './noteUtils';

const HEADING_FLASH_MS = 1200;

/** Root-level heading blocks in document order — matches extractTOC for standard notes. */
export function collectRootOutlineHeadingBlocks(blocks: readonly Block[]): Block[] {
  const headings: Block[] = [];
  for (const block of blocks) {
    if (HEADING_BLOCK_TYPES.includes(block.type)) headings.push(block);
  }
  return headings;
}

/** Depth-first heading blocks — includes headings nested inside toggles. */
export function collectOutlineHeadingBlocksDepthFirst(blocks: readonly Block[]): Block[] {
  const headings: Block[] = [];
  const walk = (list: readonly Block[]) => {
    for (const block of list) {
      if (HEADING_BLOCK_TYPES.includes(block.type)) headings.push(block);
      if (block.children.length > 0) walk(block.children);
    }
  };
  walk(blocks);
  return headings;
}

function headingLevelFromBlock(block: Block): number {
  const toggleLevel = toggleHeadingLevel(block.type);
  if (toggleLevel) return toggleLevel;
  const match = block.type.match(/^heading(\d)$/);
  return match ? Number(match[1]) : 1;
}

/** Build TOC entries from live blocks (same order as collectRootOutlineHeadingBlocks). */
export function buildTocFromBlocks(blocks: readonly Block[]): TocItem[] {
  return collectRootOutlineHeadingBlocks(blocks).map((block, line) => ({
    level: headingLevelFromBlock(block),
    text: block.content?.trim() || '(제목 없음)',
    line,
    collapsed: isToggleBlockType(block.type) ? Boolean(block.collapsed) : false,
    isToggleHeading: toggleHeadingLevel(block.type) != null,
  }));
}

/** Resolve TOC index to a live editor block id (root headings only). */
export function resolveHeadingBlockIdFromBlocks(
  blocks: readonly Block[],
  headingIdx: number,
): string | null {
  if (headingIdx < 0) return null;
  return collectRootOutlineHeadingBlocks(blocks)[headingIdx]?.id ?? null;
}

/** Resolve TOC index to a nested heading block id (depth-first document order). */
export function resolveNestedHeadingBlockIdFromBlocks(
  blocks: readonly Block[],
  headingIdx: number,
): string | null {
  if (headingIdx < 0) return null;
  return collectOutlineHeadingBlocksDepthFirst(blocks)[headingIdx]?.id ?? null;
}

export function resolveHeadingScrollTargetFromBlocks(
  blocks: readonly Block[],
  headingIdx: number,
  options?: { includeNested?: boolean },
): { blockId: string | null; selector: string; headingIdx: number } {
  const blockId = options?.includeNested
    ? resolveNestedHeadingBlockIdFromBlocks(blocks, headingIdx)
    : resolveHeadingBlockIdFromBlocks(blocks, headingIdx);
  const rootIdx = options?.includeNested
    ? collectRootOutlineHeadingBlocks(blocks).findIndex(b => b.id === blockId)
    : headingIdx;
  const beHeadingIdx = rootIdx >= 0 ? rootIdx : headingIdx;

  return {
    blockId,
    headingIdx: beHeadingIdx,
    selector: blockId
      ? `[data-block-id="${CSS.escape(blockId)}"]`
      : `[data-be-heading="${beHeadingIdx}"]`,
  };
}

export function flashHeadingElement(el: Element): void {
  const block = el.closest('.be-block') ?? el.closest('.be-virtual-block-row') ?? el;
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
  blocks: readonly Block[];
  headingIdx: number;
  scrollToBlockId?: (blockId: string) => boolean;
  onFlash?: (el: Element) => void;
  /** When true, map TOC index via depth-first heading walk (nested toggle headings). */
  includeNested?: boolean;
}

/**
 * Scroll the editor to a TOC heading using live block ids only.
 * Uses virtual list scroll when the target block is not mounted.
 */
export function navigateToHeading(options: NavigateToHeadingOptions): boolean {
  const { scrollRoot, blocks, headingIdx, scrollToBlockId, onFlash, includeNested } = options;
  const { blockId, selector } = resolveHeadingScrollTargetFromBlocks(blocks, headingIdx, {
    includeNested,
  });

  if (scrollToHeadingTarget(scrollRoot, selector, onFlash)) return true;

  if (!blockId || !scrollToBlockId?.(blockId)) {
    retryHeadingScroll(scrollRoot, selector, onFlash);
    return Boolean(blockId);
  }

  scrollToBlockId(blockId);
  retryHeadingScroll(scrollRoot, selector, onFlash);
  return true;
}
