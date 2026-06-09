import type { Block } from '../../../blockUtils';
import type { BlockRowHit } from '../../../documentFocus';
import { estimateBlockHeight } from './blockHeightEstimates';
import type { BlockVirtualizer } from './scrollToBlockId';

/**
 * Map clientY hit-testing rows from virtualizer offsets (no mounted DOM required).
 */
export function listVirtualBlockRows(
  virtualizer: BlockVirtualizer,
  blocks: Block[],
  scrollElement: HTMLElement,
): BlockRowHit[] {
  const scrollRect = scrollElement.getBoundingClientRect();
  const scrollTop = scrollElement.scrollTop;
  const rows: BlockRowHit[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;
    const measurement = virtualizer.measurementsCache[i];
    const offsetInfo = virtualizer.getOffsetForIndex(i, 'start');
    const start = measurement?.start
      ?? (Array.isArray(offsetInfo) ? offsetInfo[0] : undefined)
      ?? i * estimateBlockHeight(block);
    const height = measurement?.size && measurement.size > 0
      ? measurement.size
      : estimateBlockHeight(block);
    const top = scrollRect.top + start - scrollTop;
    rows.push({ blockId: block.id, top, bottom: top + height });
  }

  return rows;
}
