import type { Virtualizer } from '@tanstack/react-virtual';
import type { Block } from '../../../blockUtils';

export type BlockVirtualizer = Virtualizer<HTMLElement, Element>;

/**
 * Scroll the virtual list so the block with the given id is visible.
 * Groundwork for search / focus / selection integration (UX-5E.1C+).
 */
export function scrollToBlockId(
  virtualizer: BlockVirtualizer,
  blocks: Block[],
  blockId: string,
  align: 'start' | 'center' | 'end' | 'auto' = 'center',
): boolean {
  const index = blocks.findIndex(b => b.id === blockId);
  if (index < 0) return false;
  virtualizer.scrollToIndex(index, { align });
  return true;
}
