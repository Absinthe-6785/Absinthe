import { describe, expect, it, vi } from 'vitest';
import type { ExerciseBlock } from '../../../../types';
import {
  buildHealthBlockLibraryGroups,
  createHealthBlockLibrarySearchIndex,
  filterHealthBlockLibrarySearchIndex,
  sortExerciseBlocksForCatalog,
  type CatalogExerciseBlock,
  type HealthBlockLibraryGroup,
} from './healthBlockLibraryProjection';

interface WorkCounts {
  sourceTextNormalizations: number;
  queryNormalizations: number;
  sortComparisons: number;
  tieBreakComparisons: number;
}

interface GroupCounts {
  blockScans: number;
  tagMembershipComparisons: number;
  tagItemVisits: number;
}

const queries = ['e', 'ex', 'exercise', 'exercise 2', 'needle', ''];

function makeBlocks(size: number, version = 0): CatalogExerciseBlock[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `block-${String(index).padStart(4, '0')}`,
    name: `${index % 17 === 0 ? 'Needle' : 'Exercise'} ${index}${version ? ` v${version}` : ''}`,
    type: 'strength' as const,
    tags: index % 5 === 0 ? [] : index % 7 === 0 ? ['strength', 'shared', 'shared'] : ['strength', index % 2 ? 'upper' : 'shared'],
  }));
}

function instrumentLowercase<T>(run: () => T): { result: T; lowercaseCalls: number } {
  let lowercaseCalls = 0;
  const original = String.prototype.toLowerCase;
  const spy = vi.spyOn(String.prototype, 'toLowerCase').mockImplementation(function (this: string) {
    lowercaseCalls++;
    return original.call(this);
  });
  try {
    return { result: run(), lowercaseCalls };
  } finally {
    spy.mockRestore();
  }
}

function sortWithCounts(blocks: readonly CatalogExerciseBlock[], counts: WorkCounts): CatalogExerciseBlock[] {
  return [...blocks].sort((left, right) => {
    counts.sortComparisons++;
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    counts.tieBreakComparisons++;
    return left.id.localeCompare(right.id);
  });
}

function legacyRank(blocks: readonly CatalogExerciseBlock[], query: string, counts: WorkCounts) {
  counts.queryNormalizations++;
  const normalizedQuery = query.trim().toLowerCase();
  const matching = blocks.filter(block => {
    if (!normalizedQuery) return true;
    counts.sourceTextNormalizations++;
    return [block.name, ...(block.tags ?? [])].join(' ').toLowerCase().includes(normalizedQuery);
  });
  return sortWithCounts(matching, counts);
}

function projectGroups(groups: readonly HealthBlockLibraryGroup[]) {
  return groups.map(group => ({ tag: group.tag, key: group.key, ids: group.blocks.map(block => block.id) }));
}

function legacyBuildGroups(blocks: readonly ExerciseBlock[], activeTagFilter: string | null, otherLabel: string, counts: GroupCounts) {
  const allTags = Array.from(new Set(blocks.flatMap(block => {
    counts.blockScans++;
    return block.tags ?? [];
  })));
  const rows: HealthBlockLibraryGroup[] = [];
  for (const tag of allTags) {
    if (activeTagFilter && tag !== activeTagFilter) continue;
    const items = blocks.filter(block => {
      counts.blockScans++;
      for (const itemTag of block.tags ?? []) {
        counts.tagMembershipComparisons++;
        if (itemTag === tag) return true;
      }
      return false;
    });
    if (items.length > 0) rows.push({ tag, blocks: items, key: `h-${tag}` });
  }
  if (!activeTagFilter) {
    const untagged = blocks.filter(block => {
      counts.blockScans++;
      return (block.tags ?? []).length === 0;
    });
    if (untagged.length > 0) rows.push({ tag: allTags.length > 0 ? otherLabel : undefined, blocks: untagged, key: 'h-other' });
  }
  return rows;
}

function observeGroupBlocks(blocks: readonly ExerciseBlock[], counts: GroupCounts): readonly ExerciseBlock[] {
  const observedBlocks = blocks.map(block => new Proxy(block, {
    get(target, property, receiver) {
      if (property !== 'tags') return Reflect.get(target, property, receiver);
      const tags = target.tags ?? [];
      return new Proxy(tags, {
        get(tagTarget, tagProperty, tagReceiver) {
          if (tagProperty !== Symbol.iterator) return Reflect.get(tagTarget, tagProperty, tagReceiver);
          return function* observedTagIterator() {
            for (const tag of tagTarget) {
              counts.tagItemVisits++;
              yield tag;
            }
          };
        },
      });
    },
  }));

  return new Proxy(observedBlocks, {
    get(target, property, receiver) {
      if (property !== Symbol.iterator) return Reflect.get(target, property, receiver);
      return function* observedBlockIterator() {
        for (const block of target) {
          counts.blockScans++;
          yield block;
        }
      };
    },
  });
}

function baselineSequence(blocks: CatalogExerciseBlock[], replacement: CatalogExerciseBlock[], counts: WorkCounts) {
  const ranks = [legacyRank(blocks, '', counts), ...queries.map(query => legacyRank(blocks, query, counts)), legacyRank(replacement, '', counts)];
  return ranks;
}

function optimizedSequence(blocks: CatalogExerciseBlock[], replacement: CatalogExerciseBlock[], counts: WorkCounts) {
  counts.sourceTextNormalizations += blocks.length;
  sortWithCounts(blocks, counts);
  const index = createHealthBlockLibrarySearchIndex(blocks);
  const ranks = [filterHealthBlockLibrarySearchIndex(index, ''), ...queries.map(query => filterHealthBlockLibrarySearchIndex(index, query))];

  counts.sourceTextNormalizations += replacement.length;
  sortWithCounts(replacement, counts);
  const replacementIndex = createHealthBlockLibrarySearchIndex(replacement);
  ranks.push(filterHealthBlockLibrarySearchIndex(replacementIndex, ''));
  return ranks;
}

describe('Health Block Library derived search and grouping', () => {
  it('preserves joined name/tag search, trim, case folding, Unicode, and name-then-ID order', () => {
    const blocks: CatalogExerciseBlock[] = [
      { id: 'press-z', name: 'Bench', type: 'strength', tags: ['Upper Body'] },
      { id: 'press-a', name: 'Bench', type: 'strength', tags: ['Upper Body'] },
      { id: 'unicode', name: 'Élévation', type: 'strength', tags: ['ÉPAULE'] },
      { id: 'combined', name: 'Bench', type: 'strength', tags: ['compound', 'upper'] },
    ];
    const index = createHealthBlockLibrarySearchIndex(blocks);

    expect(filterHealthBlockLibrarySearchIndex(index, '  BENCH  ').map(block => block.id)).toEqual(['combined', 'press-a', 'press-z']);
    expect(filterHealthBlockLibrarySearchIndex(index, 'bench upper').map(block => block.id)).toEqual(['press-a', 'press-z']);
    expect(filterHealthBlockLibrarySearchIndex(index, 'bench compound').map(block => block.id)).toEqual(['combined']);
    expect(filterHealthBlockLibrarySearchIndex(index, 'UPPER BODY').map(block => block.id)).toEqual(['press-a', 'press-z']);
    expect(filterHealthBlockLibrarySearchIndex(index, 'ÉPAULE').map(block => block.id)).toEqual(['unicode']);
    expect(filterHealthBlockLibrarySearchIndex(index, '').map(block => block.id)).toEqual(['combined', 'press-a', 'press-z', 'unicode']);
    expect(sortExerciseBlocksForCatalog(blocks).map(block => block.id)).toEqual(['combined', 'press-a', 'press-z', 'unicode']);
  });

  it('keeps tag order, one card per unique tag, untagged/Other grouping, and filtering', () => {
    const blocks: ExerciseBlock[] = [
      { id: 'b', name: 'Beta', type: 'strength', tags: ['B', 'A', 'A'] },
      { id: 'plain', name: 'Plain', type: 'strength', tags: [] },
      { id: 'c', name: 'Charlie', type: 'strength', tags: ['B', 'C'] },
      { id: 'empty', name: 'Empty tags absent', type: 'strength' },
    ];

    expect(projectGroups(buildHealthBlockLibraryGroups(blocks, null, 'Other'))).toEqual([
      { tag: 'B', key: 'h-B', ids: ['b', 'c'] },
      { tag: 'A', key: 'h-A', ids: ['b'] },
      { tag: 'C', key: 'h-C', ids: ['c'] },
      { tag: 'Other', key: 'h-other', ids: ['plain', 'empty'] },
    ]);
    expect(projectGroups(buildHealthBlockLibraryGroups(blocks, 'B', 'Other'))).toEqual([
      { tag: 'B', key: 'h-B', ids: ['b', 'c'] },
    ]);
    expect(projectGroups(buildHealthBlockLibraryGroups(blocks, null, 'Other')).at(-1)?.ids).toEqual(['plain', 'empty']);
  });

  it.each([50, 250, 500])('keeps search/group output identical while reducing repeated work for %i blocks', size => {
    const blocks = makeBlocks(size);
    const replacement = makeBlocks(size, 1);
    const baselineCounts: WorkCounts = { sourceTextNormalizations: 0, queryNormalizations: 0, sortComparisons: 0, tieBreakComparisons: 0 };
    const optimizedCounts: WorkCounts = { sourceTextNormalizations: 0, queryNormalizations: 0, sortComparisons: 0, tieBreakComparisons: 0 };

    const baselineMeasured = instrumentLowercase(() => baselineSequence(blocks, replacement, baselineCounts));
    const optimizedMeasured = instrumentLowercase(() => optimizedSequence(blocks, replacement, optimizedCounts));
    baselineCounts.queryNormalizations = 8;
    optimizedCounts.queryNormalizations = 8;

    const baselineRanks = baselineMeasured.result;
    const optimizedRanks = optimizedMeasured.result;
    expect(optimizedRanks.map(ranked => ranked.map(block => block.id))).toEqual(baselineRanks.map(ranked => ranked.map(block => block.id)));
    expect(optimizedRanks.at(-1)?.[0]?.name).toContain('v1');
    expect(baselineMeasured.lowercaseCalls).toBe(size * 5 + 8);
    expect(optimizedMeasured.lowercaseCalls).toBe(size * 2 + 8);

    const baselineGroupCounts: GroupCounts = { blockScans: 0, tagMembershipComparisons: 0, tagItemVisits: 0 };
    const optimizedGroupCounts: GroupCounts = { blockScans: 0, tagMembershipComparisons: 0, tagItemVisits: 0 };
    const lastOriginalRank = baselineRanks[baselineRanks.length - 2]!;
    const lastOptimizedRank = optimizedRanks[optimizedRanks.length - 2]!;
    const scenarios: Array<{ base: readonly ExerciseBlock[]; optimized: readonly ExerciseBlock[]; filter: string | null }> = [
      ...baselineRanks.slice(0, 7).map((ranked, index) => ({ base: ranked, optimized: optimizedRanks[index]!, filter: null })),
      { base: lastOriginalRank, optimized: lastOptimizedRank, filter: 'strength' },
      { base: lastOriginalRank, optimized: lastOptimizedRank, filter: 'shared' },
      { base: lastOriginalRank, optimized: lastOptimizedRank, filter: null },
      { base: baselineRanks.at(-1)!, optimized: optimizedRanks.at(-1)!, filter: null },
    ];
    for (const scenario of scenarios) {
      const baselineGroups = legacyBuildGroups(scenario.base, scenario.filter, 'Other', baselineGroupCounts);
      const observedBlocks = observeGroupBlocks(scenario.optimized, optimizedGroupCounts);
      const optimizedGroups = buildHealthBlockLibraryGroups(observedBlocks, scenario.filter, 'Other');
      expect(projectGroups(optimizedGroups)).toEqual(projectGroups(baselineGroups));
    }

    expect(baselineGroupCounts.blockScans).toBeGreaterThan(optimizedGroupCounts.blockScans);
    expect(baselineGroupCounts.tagMembershipComparisons).toBeGreaterThan(0);
    expect(optimizedGroupCounts.tagItemVisits).toBeGreaterThan(0);
    expect(baselineCounts.sortComparisons).toBeGreaterThan(optimizedCounts.sortComparisons);
    expect(baselineCounts.sourceTextNormalizations).toBeGreaterThan(optimizedCounts.sourceTextNormalizations);
  });

  it('rebuilds normalized search data from replaced source blocks instead of retaining stale values', () => {
    const oldBlocks = [{ id: 'same-id', name: 'Old source', type: 'strength' as const, tags: ['legacy'] }];
    const oldIndex = createHealthBlockLibrarySearchIndex(oldBlocks);
    const replacement = [{ id: 'same-id', name: 'New source', type: 'strength' as const, tags: ['fresh'] }];
    const newIndex = createHealthBlockLibrarySearchIndex(replacement);

    expect(filterHealthBlockLibrarySearchIndex(oldIndex, 'fresh')).toEqual([]);
    expect(filterHealthBlockLibrarySearchIndex(newIndex, 'fresh')).toEqual(replacement);
    expect(filterHealthBlockLibrarySearchIndex(newIndex, 'legacy')).toEqual([]);
  });
});
