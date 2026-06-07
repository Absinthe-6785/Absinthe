/**
 * slashPalette.ts — Slash menu ranking: pinned, recent, aliases, search
 */
import {
  BLOCK_TYPE_MENU,
  filterBlockMenu,
  type BlockType,
  type BlockTypeMeta,
} from './blockUtils';
import { getSlashRecent } from './slashRecent';

export interface SlashPaletteResult {
  recent: BlockTypeMeta[];
  items: BlockTypeMeta[];
}

function metaFor(type: BlockType): BlockTypeMeta | undefined {
  return BLOCK_TYPE_MENU.find(m => m.type === type);
}

/** Build slash menu sections — recent only when query is empty. */
export function buildSlashPalette(query: string): SlashPaletteResult {
  const items = filterBlockMenu(query);
  const q = query.trim();
  if (q) return { recent: [], items };

  const recent = getSlashRecent()
    .map(metaFor)
    .filter((m): m is BlockTypeMeta => m != null);

  const recentTypes = new Set(recent.map(m => m.type));
  const dedupedItems = items.filter(m => !recentTypes.has(m.type));

  return { recent, items: dedupedItems };
}
