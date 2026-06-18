import type { WeeklySchedule } from '../../types';

/** Groups weekly blocks that share the same title (multi-day fan-out). */
export function groupWeeklySchedulesByTitle(
  schedules: readonly WeeklySchedule[],
): Map<string, WeeklySchedule[]> {
  const map = new Map<string, WeeklySchedule[]>();
  for (const sch of schedules) {
    const key = sch.title.trim().toLowerCase();
    const list = map.get(key) ?? [];
    list.push(sch);
    map.set(key, list);
  }
  return map;
}

export function isDuplicatedWeeklyTitle(
  block: WeeklySchedule,
  schedules: readonly WeeklySchedule[],
): boolean {
  const key = block.title.trim().toLowerCase();
  if (!key) return false;
  let count = 0;
  for (const sch of schedules) {
    if (sch.title.trim().toLowerCase() === key) count += 1;
  }
  return count > 1;
}
