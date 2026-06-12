import type { NoteBase } from '../../../noteUtils';
import type { ArchiveDomainMarkDay, ArchiveMarkCalendarProjection, ArchiveMonthLabel } from './archiveHomeModels';
import {
  archiveCalendarBounds,
  finalizeMarkDays,
  mergeDomainMarksIntoIndex,
} from './archiveMarkUtils';
import { buildNoteMarkIndex } from './buildNoteMarkIndex';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function buildWeeksGrid(endDate: Date): string[][] {
  const end = new Date(endDate);
  const dow = (end.getDay() + 6) % 7;
  end.setDate(end.getDate() + (6 - dow));

  const weeks: string[][] = [];
  const totalWeeks = 53;

  for (let w = totalWeeks - 1; w >= 0; w--) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(end);
      date.setDate(end.getDate() - w * 7 - (6 - d));
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      week.push(`${year}-${month}-${day}`);
    }
    weeks.push(week);
  }

  return weeks;
}

function buildMonthLabels(weeks: readonly (readonly string[])[], locale?: string): ArchiveMonthLabel[] {
  const labels: ArchiveMonthLabel[] = [];

  weeks.forEach((week, weekIndex) => {
    const first = week[0];
    if (!first) return;
    const month = Number(first.slice(5, 7));
    const year = Number(first.slice(0, 4));
    const day = Number(first.slice(8, 10));
    if (day > 7) return;

    const label = locale
      ? new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'short' })
      : MONTH_SHORT[month - 1];

    const previous = labels[labels.length - 1];
    if (previous && previous.year === year && previous.month === month) return;

    labels.push({
      year,
      month,
      label,
      weekIndex,
    });
  });

  return labels;
}

function listCalendarYears(startDate: string, endDate: string): number[] {
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  const years: number[] = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  return years;
}

export function buildArchiveMarkCalendarProjection(
  notes: readonly NoteBase[],
  domainMarks: readonly ArchiveDomainMarkDay[],
  options: { now: Date; calendarYears?: number; locale?: string },
): ArchiveMarkCalendarProjection {
  const calendarYears = options.calendarYears ?? 5;
  const { startDate, endDate } = archiveCalendarBounds(options.now, calendarYears);

  const index = buildNoteMarkIndex(notes, startDate, endDate);
  mergeDomainMarksIntoIndex(index, domainMarks, startDate, endDate);

  const days = finalizeMarkDays(index);
  const hasAnyMarks = days.some(day => day.types.length > 0);
  const years = listCalendarYears(startDate, endDate);
  const weeks = buildWeeksGrid(options.now);
  const monthLabels = buildMonthLabels(weeks, options.locale);

  return {
    startDate,
    endDate,
    days,
    years,
    monthLabels,
    weeks,
    hasAnyMarks,
  };
}
