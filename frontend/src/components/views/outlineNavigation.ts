import { markdownToBlocks, type Block } from './blockUtils';
import { HEADING_BLOCK_TYPES } from './features/block-editor/constants/blockEditorConstants';

const HEADING_FLASH_MS = 1200;

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
  return rootHeadingBlockId(markdownToBlocks(body), headingIdx);
}

export function headingScrollSelector(body: string, headingIdx: number): string {
  const blockId = resolveHeadingBlockIdAtIndex(body, headingIdx);
  if (blockId) return `[data-block-id="${blockId}"]`;
  return `[data-be-heading="${headingIdx}"]`;
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
