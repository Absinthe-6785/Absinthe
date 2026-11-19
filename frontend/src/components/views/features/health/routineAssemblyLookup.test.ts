import { describe, expect, it } from 'vitest';
import type { ExerciseBlock } from '../../../../types';
import { createHealthRoutineAssemblyLookup } from './routineAssemblyLookup';

type Counts = Record<string, number>;
type Metrics = {
  blockFindComparisons: number;
  selectedIncludesComparisons: number;
  selectedIndexOfComparisons: number;
  blockIndexInputVisits: number;
  selectedIndexInputVisits: number;
  blockMapGets: number;
  selectedIndexMapGets: number;
};

const block = (id: string, name: string, tags: string[] = []): ExerciseBlock => ({ id, name, type: 'strength', tags });
const emptyMetrics = (): Metrics => ({
  blockFindComparisons: 0,
  selectedIncludesComparisons: 0,
  selectedIndexOfComparisons: 0,
  blockIndexInputVisits: 0,
  selectedIndexInputVisits: 0,
  blockMapGets: 0,
  selectedIndexMapGets: 0,
});

function buildTagGroups(blocks: readonly ExerciseBlock[]) {
  const groups: Record<string, ExerciseBlock[]> = {};
  for (const item of blocks) {
    const tags = item.tags?.length ? item.tags : ['OTHER'];
    tags.forEach(tag => {
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(item);
    });
  }
  return Object.keys(groups).sort((a, b) =>
    a === 'OTHER' ? 1 : b === 'OTHER' ? -1 : a.localeCompare(b),
  ).map(tag => [tag, groups[tag]!] as const);
}

function firstBlock(blocks: readonly ExerciseBlock[], id: string, metrics: Metrics) {
  for (const item of blocks) {
    metrics.blockFindComparisons++;
    if (item.id === id) return item;
  }
  return undefined;
}

function includesFirst(selectedIds: readonly string[], id: string, metrics: Metrics) {
  for (const selectedId of selectedIds) {
    metrics.selectedIncludesComparisons++;
    if (selectedId === id) return true;
  }
  return false;
}

function indexOfFirst(selectedIds: readonly string[], id: string, metrics: Metrics) {
  for (let index = 0; index < selectedIds.length; index++) {
    metrics.selectedIndexOfComparisons++;
    if (selectedIds[index] === id) return index;
  }
  return -1;
}

function baselineView(blocks: readonly ExerciseBlock[], selectedIds: readonly string[], planned: Counts, fallback: Counts, metrics: Metrics) {
  const selectedPreview = selectedIds.flatMap(id => {
    const item = firstBlock(blocks, id, metrics);
    return item ? [{ id: item.id, name: item.name, plannedSetValue: planned[id] ?? fallback[id] ?? '' }] : [];
  });
  const tagGroups = buildTagGroups(blocks).map(([tag, items]) => [tag, items.map(item => {
    const selected = includesFirst(selectedIds, item.id, metrics);
    const selectedIndex = indexOfFirst(selectedIds, item.id, metrics);
    return { id: item.id, name: item.name, selected, selectedPosition: selectedIndex < 0 ? null : selectedIndex + 1 };
  })] as const);
  return { selectedPreview, tagGroups };
}

function observeInput<T>(values: readonly T[], onVisit: () => void): readonly T[] {
  return new Proxy(values as T[], {
    get(target, property, receiver) {
      if (property === Symbol.iterator) {
        // The block index uses iteration.
        return function* observedIterator() {
          for (const value of target) {
            onVisit();
            yield value;
          }
        };
      }
      // The selected-ID index intentionally uses indexed access so its
      // first-occurrence semantics are explicit.
      if (typeof property === 'string' && /^(0|[1-9]\d*)$/.test(property)) onVisit();
      return Reflect.get(target, property, receiver);
    },
  });
}

function indexedView(blocks: readonly ExerciseBlock[], selectedIds: readonly string[], planned: Counts, fallback: Counts, metrics: Metrics) {
  const blockInput = observeInput(blocks, () => metrics.blockIndexInputVisits++);
  const selectedInput = observeInput(selectedIds, () => metrics.selectedIndexInputVisits++);
  const { blockById, selectedIndexById } = createHealthRoutineAssemblyLookup(blockInput, selectedInput);
  const selectedPreview = selectedIds.flatMap(id => {
    metrics.blockMapGets++;
    const item = blockById.get(id);
    return item ? [{ id: item.id, name: item.name, plannedSetValue: planned[id] ?? fallback[id] ?? '' }] : [];
  });
  const tagGroups = buildTagGroups(blocks).map(([tag, items]) => [tag, items.map(item => {
    metrics.selectedIndexMapGets++;
    const selectedIndex = selectedIndexById.get(item.id);
    return { id: item.id, name: item.name, selected: selectedIndex !== undefined,
      selectedPosition: selectedIndex === undefined ? null : selectedIndex + 1 };
  })] as const);
  return { selectedPreview, tagGroups };
}

function makeBlocks(size: number): ExerciseBlock[] {
  return Array.from({ length: size }, (_, index) => block(
    `block-${index}`,
    `Exercise ${index}`,
    index % 13 === 0 ? [] : index % 11 === 0 ? ['Tag-A', 'Shared', 'Shared'] : ['Tag-A', index % 2 ? 'Tag-B' : 'Shared'],
  ));
}

function interactionSnapshots(size: number, selectedCount: number) {
  const initial = Array.from({ length: selectedCount }, (_, index) => `block-${size - selectedCount + index}`);
  const selected = [...initial, `block-${size - selectedCount - 1}`];
  const deselected = selected.filter((_, index) => index !== 2);
  const reordered = deselected.slice().reverse();
  return [
    { ids: initial, planned: { [initial[0]!]: 3 } },
    { ids: selected, planned: { [selected.at(-1)!]: 5 } },
    { ids: deselected, planned: {} },
    { ids: reordered, planned: { [reordered[0]!]: 7 } }, // touch/drag reorder
    { ids: reordered.slice(), planned: { [reordered[0]!]: 9 } }, // planned-set edit
    { ids: reordered.slice(), planned: { [reordered[0]!]: 9 } }, // unrelated modal update
  ];
}

describe('Health Routine Assemble render-local lookup', () => {
  it.each([
    {
      size: 50, selectedCount: 5,
      expected: { blockFindComparisons: 1473, selectedIncludesComparisons: 2958, selectedIndexOfComparisons: 2958,
        blockIndexInputVisits: 300, selectedIndexInputVisits: 31, blockMapGets: 31, selectedIndexMapGets: 600 },
    },
    {
      size: 500, selectedCount: 20,
      expected: { blockFindComparisons: 59328, selectedIncludesComparisons: 119045, selectedIndexOfComparisons: 119045,
        blockIndexInputVisits: 3000, selectedIndexInputVisits: 121, blockMapGets: 121, selectedIndexMapGets: 6018 },
    },
  ])('keeps rendered lookup output identical while reducing repeated array comparisons for $size blocks', ({ size, selectedCount, expected }) => {
    const blocks = makeBlocks(size);
    const fallback = Object.fromEntries(blocks.map((item, index) => [item.id, index % 12 + 1]));
    const baselineMetrics = emptyMetrics();
    const indexedMetrics = emptyMetrics();
    const snapshots = interactionSnapshots(size, selectedCount);

    for (const snapshot of snapshots) {
      expect(indexedView(blocks, snapshot.ids, snapshot.planned, fallback, indexedMetrics))
        .toEqual(baselineView(blocks, snapshot.ids, snapshot.planned, fallback, baselineMetrics));
    }

    expect(baselineMetrics).toEqual({ ...emptyMetrics(), ...expected,
      blockIndexInputVisits: 0, selectedIndexInputVisits: 0, blockMapGets: 0, selectedIndexMapGets: 0 });
    expect(indexedMetrics).toEqual({ ...emptyMetrics(), ...expected,
      blockFindComparisons: 0, selectedIncludesComparisons: 0, selectedIndexOfComparisons: 0 });
  });

  it('preserves first-match duplicate-ID semantics, duplicate tag appearances, ordering, and OTHER-last output', () => {
    const firstDuplicate = block('duplicate', 'First duplicate', ['Shared', 'Shared', 'Alpha']);
    const blocks = [firstDuplicate, block('duplicate', 'Later duplicate', ['Later']), block('untagged', 'Untagged')];
    const selectedIds = ['duplicate', 'duplicate'];
    const baselineMetrics = emptyMetrics();
    const indexedMetrics = emptyMetrics();
    const baseline = baselineView(blocks, selectedIds, {}, {}, baselineMetrics);
    const indexed = indexedView(blocks, selectedIds, {}, {}, indexedMetrics);

    expect(indexed).toEqual(baseline);
    expect(indexed.selectedPreview.map(item => item.name)).toEqual(['First duplicate', 'First duplicate']);
    expect(indexed.tagGroups.map(([tag]) => tag).at(-1)).toBe('OTHER');
    const shared = indexed.tagGroups.find(([tag]) => tag === 'Shared')![1];
    expect(shared.filter(item => item.id === 'duplicate')).toHaveLength(2);
    expect(shared.filter(item => item.id === 'duplicate').map(item => item.selectedPosition)).toEqual([1, 1]);
  });

  it('uses fresh indexes after block-source replacement and in-place semantic updates', () => {
    const initial = [block('source-id', 'Old name', ['Old tag'])];
    const initialLookup = createHealthRoutineAssemblyLookup(initial, ['source-id']);
    const replacementBlock = block('source-id', 'Replacement name', ['Replacement tag']);
    const replacementLookup = createHealthRoutineAssemblyLookup([replacementBlock], ['source-id']);
    expect(initialLookup.blockById.get('source-id')).toBe(initial[0]);
    expect(replacementLookup.blockById.get('source-id')).toBe(replacementBlock);
    expect(replacementLookup.blockById.get('source-id')?.name).toBe('Replacement name');

    initial[0]!.id = 'mutated-id';
    initial[0]!.name = 'Mutated name';
    initial[0]!.tags = ['Mutated tag'];
    const inPlaceLookup = createHealthRoutineAssemblyLookup(initial, ['mutated-id']);
    expect(inPlaceLookup.blockById.has('source-id')).toBe(false);
    expect(inPlaceLookup.blockById.get('mutated-id')).toBe(initial[0]);
    expect(inPlaceLookup.blockById.get('mutated-id')?.name).toBe('Mutated name');
    expect(inPlaceLookup.selectedIndexById.get('mutated-id')).toBe(0);
  });

  it('omits stale selected IDs from the preview after their source block disappears', () => {
    const initial = [block('kept-id', 'Kept exercise'), block('removed-id', 'Removed exercise')];
    const selectedIds = ['removed-id', 'missing-id', 'kept-id'];
    const nextBlocks = [block('kept-id', 'Updated kept exercise')];
    const baselineMetrics = emptyMetrics();
    const indexedMetrics = emptyMetrics();

    const baseline = baselineView(nextBlocks, selectedIds, {}, {}, baselineMetrics);
    const indexed = indexedView(nextBlocks, selectedIds, {}, {}, indexedMetrics);

    expect(indexed).toEqual(baseline);
    expect(indexed.selectedPreview).toEqual([{ id: 'kept-id', name: 'Updated kept exercise', plannedSetValue: '' }]);
    expect(indexed.tagGroups.flatMap(([, items]) => items)
      .filter(item => item.selected).map(item => item.id)).toEqual(['kept-id']);
  });
});
