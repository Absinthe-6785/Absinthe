import type { Block, BlockType } from '../../../blockUtils';
import type { BlockTypeMeta } from '../../../blockUtils';
import { HEADING_BLOCK_TYPES } from '../constants/blockEditorConstants';
import { isToggleBlockType } from '../../../toggleBlockTypes';
import { DEFAULT_CALLOUT_ICON } from '../../../calloutPresets';

export function insertBlockAtIndex(blocks: Block[], index: number, block: Block): Block[] {
  const next = [...blocks];
  next.splice(index, 0, block);
  return next;
}

export function moveBlockInList(
  blocks: Block[],
  id: string,
  dir: 'up' | 'down',
): Block[] | null {
  const idx = blocks.findIndex(b => b.id === id);
  if (idx < 0) return null;
  const newIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= blocks.length) return null;
  const next = [...blocks];
  [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
  return next;
}

export function enterSplitBlockType(currentType: BlockType): BlockType {
  return HEADING_BLOCK_TYPES.includes(currentType) ? 'paragraph' : currentType;
}

export function applySlashMenuTypeChange(block: Block, meta: BlockTypeMeta, query: string): Block {
  const type = meta.type;
  const slashIdx = block.content.lastIndexOf('/' + query);
  const cleaned = slashIdx >= 0
    ? block.content.slice(0, slashIdx) + block.content.slice(slashIdx + 1 + query.length)
    : block.content;
  if (type === 'math') {
    return { ...block, type, content: '', math: block.math || cleaned, mathBlock: (block.math || cleaned).includes('\n'), ...meta.createDefaults };
  }
  if (type === 'code') {
    return { ...block, type, content: '', code: block.code || cleaned, ...meta.createDefaults };
  }
  if (type === 'image') {
    return { ...block, type, content: '', src: '', alt: '', caption: undefined, width: undefined, ...meta.createDefaults };
  }
  if (type === 'mermaid') {
    return { ...block, type, content: '', mermaid: block.mermaid || cleaned, ...meta.createDefaults };
  }
  if (type === 'audio') {
    return { ...block, type, content: '', src: '', caption: undefined, ...meta.createDefaults };
  }
  if (type === 'footnote') {
    return { ...block, type, content: cleaned, footnoteId: meta.createDefaults?.footnoteId ?? block.footnoteId ?? '1', ...meta.createDefaults };
  }
  if (type === 'citation') {
    return {
      ...block,
      type,
      content: '',
      citationTitle: block.citationTitle ?? '',
      citationAuthor: block.citationAuthor ?? '',
      citationYear: block.citationYear ?? '',
      ...meta.createDefaults,
    };
  }
  if (type === 'question') {
    return { ...block, type, content: cleaned, ...meta.createDefaults };
  }
  if (type === 'answer') {
    return { ...block, type, content: cleaned, answerRevealed: meta.createDefaults?.answerRevealed ?? block.answerRevealed ?? false, ...meta.createDefaults };
  }
  const next: Block = { ...block, type, content: cleaned, ...meta.createDefaults };
  if (isToggleBlockType(type)) next.collapsed = next.collapsed ?? false;
  if (type === 'callout' && !next.calloutIcon) next.calloutIcon = DEFAULT_CALLOUT_ICON;
  return next;
}

export function getPasteBlockContext(
  block: Block | null | undefined,
): { blockType: BlockType; indent: number } | undefined {
  return block ? { blockType: block.type, indent: block.indent } : undefined;
}
