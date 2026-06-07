import type { Block } from './blockUtils';
import { flattenBlockIds, findBlockById, isTextBlockType } from './blockUtils';

export type EditorSearchScope = 'block' | 'document' | 'all';

export interface EditorSearchMatch {
  blockId: string;
  /** Character offset of match start within block searchable text */
  offset: number;
}

function blockSearchText(block: Block): string {
  if (isTextBlockType(block.type)) return block.content;
  if (block.type === 'code') return block.code ?? '';
  if (block.type === 'math') return block.math ?? '';
  return '';
}

/** Collect all matches in a block tree for document-scope search. */
export function collectEditorSearchMatches(blocks: Block[], query: string): EditorSearchMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: EditorSearchMatch[] = [];
  for (const id of flattenBlockIds(blocks)) {
    const block = findBlockById(blocks, id);
    if (!block) continue;
    const text = blockSearchText(block).toLowerCase();
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(q, from);
      if (idx < 0) break;
      matches.push({ blockId: id, offset: idx });
      from = idx + Math.max(1, q.length);
    }
  }
  return matches;
}

export function shouldHighlightBlock(
  scope: EditorSearchScope,
  blockId: string,
  activeBlockId: string | null,
): boolean {
  if (scope === 'all' || scope === 'document') return true;
  return scope === 'block' && activeBlockId === blockId;
}
