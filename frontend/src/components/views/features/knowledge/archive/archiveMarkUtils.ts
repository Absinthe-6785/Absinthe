import type { ArchiveDomainMarkDay, ArchiveMarkDay, ArchiveMarkType } from './archiveHomeModels';

export function computeMarkDensity(types: readonly ArchiveMarkType[]): number {
  return types.filter(type => type !== 'exception').length;
}

export function domainMarkDayToTypes(day: ArchiveDomainMarkDay): ArchiveMarkType[] {
  const types: ArchiveMarkType[] = [];
  if (day.workout_count > 0) types.push('workout');
  if (day.routine_done > 0) types.push('routine');
  if (day.study_mins > 0) types.push('scheduled-study');
  if (day.is_exception) types.push('exception');
  return types;
}

export function isDateInRange(dateKey: string, startDate: string, endDate: string): boolean {
  return dateKey >= startDate && dateKey <= endDate;
}

export function archiveCalendarBounds(
  now: Date,
  calendarYears: number,
): { startDate: string; endDate: string } {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const endDate = `${year}-${month}-${day}`;
  const startYear = year - calendarYears + 1;
  const startDate = `${startYear}-01-01`;
  return { startDate, endDate };
}

export type ArchiveMarkIndex = Map<string, Set<ArchiveMarkType>>;

export function addMarkType(index: ArchiveMarkIndex, dateKey: string, type: ArchiveMarkType): void {
  let types = index.get(dateKey);
  if (!types) {
    types = new Set();
    index.set(dateKey, types);
  }
  types.add(type);
}

export function finalizeMarkDays(index: ArchiveMarkIndex): ArchiveMarkDay[] {
  return [...index.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, types]) => {
      const sortedTypes = [...types].sort() as ArchiveMarkType[];
      return {
        date,
        types: sortedTypes,
        density: computeMarkDensity(sortedTypes),
      };
    });
}

export function mergeDomainMarksIntoIndex(
  index: ArchiveMarkIndex,
  domainMarks: readonly ArchiveDomainMarkDay[],
  startDate: string,
  endDate: string,
): void {
  for (const row of domainMarks) {
    if (!isDateInRange(row.date, startDate, endDate)) continue;
    for (const type of domainMarkDayToTypes(row)) {
      addMarkType(index, row.date, type);
    }
  }
}
