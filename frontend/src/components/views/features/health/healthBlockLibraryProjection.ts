import type { ExerciseBlock } from '../../../../types';

export type CatalogExerciseBlock = ExerciseBlock & { recentRank?: number };

export interface HealthBlockLibrarySearchEntry {
  block: CatalogExerciseBlock;
  normalizedSearchText: string;
}

export interface HealthBlockLibraryGroup {
  tag?: string;
  blocks: ExerciseBlock[];
  key: string;
}

/** Keep catalog order independent from workout-history rank and API row order. */
export function compareCatalogExerciseBlocks(left: CatalogExerciseBlock, right: CatalogExerciseBlock): number {
  const byName = left.name.localeCompare(right.name);
  return byName !== 0 ? byName : left.id.localeCompare(right.id);
}

export function sortExerciseBlocksForCatalog(blocks: readonly CatalogExerciseBlock[]): CatalogExerciseBlock[] {
  return [...blocks].sort(compareCatalogExerciseBlocks);
}

/** Build one source-scoped text/order projection; callers rebuild when block data is replaced. */
export function createHealthBlockLibrarySearchIndex(
  blocks: readonly CatalogExerciseBlock[],
): HealthBlockLibrarySearchEntry[] {
  return sortExerciseBlocksForCatalog(blocks).map(block => ({
    block,
    normalizedSearchText: [block.name, ...(block.tags ?? [])].join(' ').toLowerCase(),
  }));
}

export function filterHealthBlockLibrarySearchIndex(
  index: readonly HealthBlockLibrarySearchEntry[],
  query: string,
): CatalogExerciseBlock[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return index.map(entry => entry.block);
  return index.filter(entry => entry.normalizedSearchText.includes(normalizedQuery))
    .map(entry => entry.block);
}

/** Assemble tag rows in one source pass while preserving tag and block order. */
export function buildHealthBlockLibraryGroups(
  blocks: readonly ExerciseBlock[],
  activeTagFilter: string | null,
  otherLabel: string,
): HealthBlockLibraryGroup[] {
  const groups = new Map<string, ExerciseBlock[]>();
  const untagged: ExerciseBlock[] = [];

  for (const block of blocks) {
    const tags = block.tags ?? [];
    if (tags.length === 0) {
      if (!activeTagFilter) untagged.push(block);
      continue;
    }

    for (const tag of new Set(tags)) {
      if (activeTagFilter && tag !== activeTagFilter) continue;
      const group = groups.get(tag);
      if (group) group.push(block);
      else groups.set(tag, [block]);
    }
  }

  const rows: HealthBlockLibraryGroup[] = Array.from(groups, ([tag, items]) => ({
    tag,
    blocks: items,
    key: `h-${tag}`,
  }));
  if (!activeTagFilter && untagged.length > 0) {
    rows.push({ tag: groups.size > 0 ? otherLabel : undefined, blocks: untagged, key: 'h-other' });
  }
  return rows;
}
