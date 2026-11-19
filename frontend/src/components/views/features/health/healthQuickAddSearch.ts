import type { ExerciseBlock } from '../../../../types';

export interface HealthQuickAddSearchEntry {
  readonly block: ExerciseBlock;
  readonly normalizedText: string;
}

export function createHealthQuickAddSearchIndex(
  blocks: readonly ExerciseBlock[],
): HealthQuickAddSearchEntry[] {
  return blocks.map(block => ({
    block,
    normalizedText: [block.name, ...(block.tags ?? [])].join(' ').toLowerCase(),
  }));
}

export function searchHealthQuickAddIndex(
  index: readonly HealthQuickAddSearchEntry[],
  rawQuery: string,
): HealthQuickAddSearchEntry[] {
  const query = rawQuery.trim().toLowerCase();
  return index.filter(entry => !query || entry.normalizedText.includes(query));
}
