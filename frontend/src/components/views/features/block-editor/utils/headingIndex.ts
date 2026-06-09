import type { Block } from '../../../blockUtils';
import { HEADING_BLOCK_TYPES } from '../constants/blockEditorConstants';

/** 최상위(depth 0) 헤딩 블록의 순번 — TOC(extractTOC와 동일한 문서 순서) 점프 타겟 */
export function buildHeadingIndexById(blocks: Block[], depth: number): Record<string, number> {
  const m: Record<string, number> = {};
  if (depth === 0) {
    let h = 0;
    for (const b of blocks) {
      if (HEADING_BLOCK_TYPES.includes(b.type)) m[b.id] = h++;
    }
  }
  return m;
}
