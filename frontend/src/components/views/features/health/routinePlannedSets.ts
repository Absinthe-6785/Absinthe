import type { WorkoutSet } from '@/types';

const STORAGE_KEY = 'healthRoutinePlannedSets';

export type RoutinePlannedSetsMap = Record<string, Record<string, number>>;

function readAll(): RoutinePlannedSetsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RoutinePlannedSetsMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: RoutinePlannedSetsMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getRoutinePlannedSetsForDay(dayName: string): Record<string, number> {
  return { ...readAll()[dayName] };
}

export function getRoutinePlannedSetCount(
  dayName: string,
  blockId: string,
  blockType: string,
  prevSets?: readonly WorkoutSet[],
): number {
  if (blockType === 'cardio') return 1;
  const stored = readAll()[dayName]?.[blockId];
  if (stored && stored >= 1) return Math.min(12, stored);
  if (prevSets && prevSets.length > 0) return prevSets.length;
  return 3;
}

export function setRoutinePlannedSetCount(dayName: string, blockId: string, count: number): void {
  const all = readAll();
  const day = { ...(all[dayName] ?? {}) };
  if (count < 1) {
    delete day[blockId];
  } else {
    day[blockId] = Math.min(12, Math.max(1, count));
  }
  all[dayName] = day;
  writeAll(all);
}

export function saveRoutinePlannedSetsForDay(
  dayName: string,
  blockIds: readonly string[],
  counts: Record<string, number>,
): void {
  const all = readAll();
  const day: Record<string, number> = {};
  for (const id of blockIds) {
    const c = counts[id];
    if (c && c >= 1) day[id] = Math.min(12, c);
  }
  all[dayName] = day;
  writeAll(all);
}

export function showsPlannedSetCount(blockType: string): boolean {
  return blockType !== 'cardio';
}
