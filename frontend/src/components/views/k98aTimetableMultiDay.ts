import type { WeeklySchedule } from '@/types';

/** Expand one activity template into per-weekday schedule payloads (K-98A). */
export function expandWeeklyScheduleDays(
  base: Partial<WeeklySchedule>,
  selectedDays: readonly number[],
): Partial<WeeklySchedule>[] {
  const uniqueDays = [...new Set(selectedDays.filter(d => d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (uniqueDays.length === 0) return [];
  return uniqueDays.map(day => ({ ...base, day }));
}

/** Whether a weekly timetable save should fan out into multiple records. */
export function shouldFanOutWeeklyCreate(
  editingId: string | null,
  selectedDays: readonly number[],
): boolean {
  return !editingId && selectedDays.length > 1;
}

/** Group weekly blocks that share title/time/color for multi-day edit display. */
export function weeklyScheduleSiblingIds(
  block: WeeklySchedule,
  all: readonly WeeklySchedule[],
): string[] {
  return weeklyScheduleLinkedBlocks(block, all)
    .filter(s => s.id !== block.id)
    .map(s => s.id);
}

export function weeklyScheduleLinkedBlocks(
  block: WeeklySchedule,
  all: readonly WeeklySchedule[],
): WeeklySchedule[] {
  return all
    .filter(
      s =>
        s.title === block.title
        && s.start_time === block.start_time
        && s.end_time === block.end_time
        && s.color === block.color,
    )
    .sort((a, b) => a.day - b.day);
}
