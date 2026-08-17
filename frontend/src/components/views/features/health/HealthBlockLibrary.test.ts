import { describe, expect, it } from 'vitest';
import type { ExerciseBlock } from '../../../../types';
import { sortExerciseBlocksForCatalog, type CatalogExerciseBlock } from './HealthBlockLibrary';

const catalog: CatalogExerciseBlock[] = [
  { id: 'block-z', name: 'Press', type: 'strength', tags: [], recentRank: 1 },
  { id: 'block-a', name: 'Squat', type: 'strength', tags: [] },
  { id: 'block-b', name: 'Press', type: 'strength', tags: [], recentRank: 0 },
  { id: 'block-c', name: 'Abs', type: 'strength', tags: [] },
];

describe('Health exercise catalog ordering', () => {
  it('is stable across date/month navigation and does not mutate static source data', () => {
    const sourceBefore = structuredClone(catalog);

    const currentMonth = sortExerciseBlocksForCatalog(catalog);
    const historicalMonth = sortExerciseBlocksForCatalog(catalog);

    expect(currentMonth.map(block => block.id)).toEqual(['block-b', 'block-z', 'block-c', 'block-a']);
    expect(historicalMonth.map(block => block.id)).toEqual(currentMonth.map(block => block.id));
    expect(catalog).toEqual(sourceBefore);
  });

  it('falls back to deterministic name then ID ordering when recency is absent', () => {
    const equalNames: ExerciseBlock[] = [
      { id: 'block-z', name: 'Press', type: 'strength', tags: [] },
      { id: 'block-a', name: 'Press', type: 'strength', tags: [] },
    ];

    expect(sortExerciseBlocksForCatalog(equalNames).map(block => block.id)).toEqual(['block-a', 'block-z']);
  });
});
