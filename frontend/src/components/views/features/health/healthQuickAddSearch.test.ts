import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseBlock } from '../../../../types';
import { createHealthQuickAddSearchIndex, searchHealthQuickAddIndex } from './healthQuickAddSearch';

const block = (id: string, name: string, tags: string[] = []): ExerciseBlock => ({
  id, name, type: 'strength', tags,
});

describe('Health Quick Add search index', () => {
  it('preserves name, tag, joined-field, adjacent-tag, case, whitespace, Unicode, and empty-field matching', () => {
    const blocks = [
      block('press', 'Bench Press', ['Upper', 'Body']),
      block('row', 'Cable Row', ['背中', 'Lat']),
      block('empty-name', '', ['', 'Mobility']),
    ];
    const index = createHealthQuickAddSearchIndex(blocks);
    const ids = (query: string) => searchHealthQuickAddIndex(index, query).map(entry => entry.block.id);

    expect(ids('  BENCH  ')).toEqual(['press']);
    expect(ids('upper')).toEqual(['press']);
    expect(ids('press upper')).toEqual(['press']);
    expect(ids('upper body')).toEqual(['press']);
    expect(ids('背中 lat')).toEqual(['row']);
    expect(ids('mobility')).toEqual(['empty-name']);
    expect(ids('   ')).toEqual(['press', 'row', 'empty-name']);
    expect(ids('missing')).toEqual([]);
  });

  it('keeps original order and exact block objects for empty and matching queries', () => {
    const blocks = [block('z', 'Pull', ['row']), block('a', 'Pull-down', ['row']), block('m', 'Press', ['row'])];
    const index = createHealthQuickAddSearchIndex(blocks);

    expect(searchHealthQuickAddIndex(index, '').map(entry => entry.block.id)).toEqual(['z', 'a', 'm']);
    expect(searchHealthQuickAddIndex(index, 'row').map(entry => entry.block)).toEqual(blocks);
    expect(searchHealthQuickAddIndex(index, 'row').map(entry => entry.block)).toEqual([blocks[0], blocks[1], blocks[2]]);
  });

  it('reflects changed block names and tags when the source array is replaced', () => {
    const original = [block('stable-id', 'Old name', ['old-tag'])];
    const oldIndex = createHealthQuickAddSearchIndex(original);
    const replacement = [{ ...original[0]!, name: 'New name', tags: ['new-tag'] }];
    const newIndex = createHealthQuickAddSearchIndex(replacement);

    expect(searchHealthQuickAddIndex(oldIndex, 'old-tag').map(entry => entry.block.id)).toEqual(['stable-id']);
    expect(searchHealthQuickAddIndex(newIndex, 'old-tag')).toEqual([]);
    expect(searchHealthQuickAddIndex(newIndex, 'new name').map(entry => entry.block.id)).toEqual(['stable-id']);
    expect(searchHealthQuickAddIndex(newIndex, 'new-tag').map(entry => entry.block.id)).toEqual(['stable-id']);
  });

  it.each([50, 250, 500])('reduces repeated source-text normalization for %i blocks without reducing scan coverage', size => {
    const blocks = Array.from({ length: size }, (_, index) => block(
      `exercise-${index}`, `Exercise ${index} Upper`, [index % 2 ? 'Upper Body' : 'Lower Body', '背中', `Tag ${index}`],
    ));
    const queryUpdates = ['e', 'ex', 'exercise 4', 'upper body', '背中', ''];

    const countSourceNormalizations = <T,>(action: () => T) => {
      const sourceTexts = new Set(blocks.map(item => [item.name, ...(item.tags ?? [])].join(' ')));
      const original = String.prototype.toLowerCase;
      let sourceTextNormalizations = 0;
      const spy = vi.spyOn(String.prototype, 'toLowerCase').mockImplementation(function (this: string) {
        if (sourceTexts.has(String(this))) sourceTextNormalizations++;
        return original.call(this);
      });
      try { return { value: action(), sourceTextNormalizations }; }
      finally { spy.mockRestore(); }
    };
    const observeScans = <T,>(values: readonly T[], onVisit: () => void): readonly T[] => new Proxy(values as T[], {
      get(target, property, receiver) {
        if (property !== 'filter') return Reflect.get(target, property, receiver);
        return (predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown) =>
          Array.prototype.filter.call(target, (value: T, index: number, array: T[]) => {
            onVisit();
            return predicate.call(thisArg, value, index, array);
          }) as T[];
      },
    });

    const baseline = countSourceNormalizations(() => {
      let scans = 0;
      const searchableBlocks = observeScans(blocks, () => scans++);
      const search = (rawQuery: string) => {
        const query = rawQuery.trim().toLowerCase();
        return searchableBlocks.filter(item => !query
          || [item.name, ...(item.tags ?? [])].join(' ').toLowerCase().includes(query)).map(item => item.id);
      };
      const ids = [search(''), ...queryUpdates.map(search)];
      return { ids, scans };
    });
    const optimized = countSourceNormalizations(() => {
      const index = createHealthQuickAddSearchIndex(blocks);
      let scans = 0;
      const searchableIndex = observeScans(index, () => scans++);
      const search = (rawQuery: string) =>
        searchHealthQuickAddIndex(searchableIndex, rawQuery).map(entry => entry.block.id);
      const ids = [search(''), ...queryUpdates.map(search)];
      return { ids, scans };
    });

    expect(optimized.value.ids).toEqual(baseline.value.ids);
    expect(baseline.sourceTextNormalizations).toBe(size * 5);
    expect(optimized.sourceTextNormalizations).toBe(size);
    expect(baseline.value.scans).toBe(size * 7);
    expect(optimized.value.scans).toBe(size * 7);
  });
});

afterEach(() => vi.restoreAllMocks());
