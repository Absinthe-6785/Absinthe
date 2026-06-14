import type { ArchiveMarkDay, ArchiveMarkType } from '../../knowledge/archive';

const MARK_TYPE_LABELS: Record<ArchiveMarkType, string> = {
  'note-activity': 'Note activity',
  milestone: 'Milestone',
  event: 'Event',
  workout: 'Workout',
  routine: 'Routine mark',
  'scheduled-study': 'Scheduled study',
  exception: 'Exception day',
};

/** Neutral tooltip copy from projection types — no scores or performance language. */
export function formatArchiveMarkDayTooltip(
  day: ArchiveMarkDay | undefined,
  dateKey: string,
): string {
  if (!day || day.types.length === 0) return dateKey;
  const parts = day.types.map(type => MARK_TYPE_LABELS[type]);
  return `${dateKey} · ${parts.join(' · ')}`;
}

/** Visual density level 0–3 from projection density field. */
export function archiveMarkCellDensityLevel(day: ArchiveMarkDay | undefined): number {
  if (!day) return 0;
  return Math.min(Math.max(day.density, 0), 3);
}

export function archiveMarkCellIsException(day: ArchiveMarkDay | undefined): boolean {
  return day?.types.includes('exception') ?? false;
}

export function archiveMarkCellColorClass(
  densityLevel: number,
  isException: boolean,
  darkMode: boolean,
): string {
  if (isException) {
    return darkMode ? 'bg-blue-900/40' : 'bg-blue-100';
  }

  if (densityLevel <= 0) {
    return darkMode ? 'bg-gray-800' : 'bg-gray-200';
  }

  const palette = darkMode
    ? ['bg-gray-800', 'bg-primary/25', 'bg-primary/45', 'bg-primary/65']
    : ['bg-gray-200', 'bg-primary/20', 'bg-primary/35', 'bg-primary/50'];

  return palette[densityLevel] ?? palette[0];
}

export function formatArchiveMarkCalendarYearSpan(years: readonly number[]): string {
  if (years.length === 0) return '';
  if (years.length === 1) return String(years[0]);
  return `${years[0]}–${years[years.length - 1]}`;
}

export function isArchiveMarkCalendarInRange(
  dateKey: string,
  startDate: string,
  endDate: string,
): boolean {
  return dateKey >= startDate && dateKey <= endDate;
}

export function isArchiveMarkCalendarFuture(dateKey: string, endDate: string): boolean {
  return dateKey > endDate;
}
