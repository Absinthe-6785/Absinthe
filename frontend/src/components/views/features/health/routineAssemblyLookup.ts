import type { ExerciseBlock } from '../../../../types';

export interface HealthRoutineAssemblyLookup {
  readonly blockById: ReadonlyMap<string, ExerciseBlock>;
  readonly selectedIndexById: ReadonlyMap<string, number>;
}

/** Builds fresh render-local indexes while matching Array.find/indexOf first-match behavior. */
export function createHealthRoutineAssemblyLookup(
  blocks: readonly ExerciseBlock[],
  selectedIds: readonly string[],
): HealthRoutineAssemblyLookup {
  const blockById = new Map<string, ExerciseBlock>();
  for (const block of blocks) {
    if (!blockById.has(block.id)) blockById.set(block.id, block);
  }

  const selectedIndexById = new Map<string, number>();
  for (let index = 0; index < selectedIds.length; index++) {
    const id = selectedIds[index]!;
    if (!selectedIndexById.has(id)) selectedIndexById.set(id, index);
  }

  return { blockById, selectedIndexById };
}
