import { formatCalendarMonthLabel } from '../databaseViews/parseDatabaseDate';
import {
  formatTraceMonthHeading,
  formatTraceQuarterHeading,
  formatTraceYearHeading,
} from '../trace/buildRangeTraceProjection';
import type { ArchivePeriodRef } from './archiveHomeModels';

export function archivePeriodRefFromMonth(
  year: number,
  month: number,
  locale?: string,
): ArchivePeriodRef {
  return {
    kind: 'month',
    year,
    month,
    label: formatTraceMonthHeading(year, month, locale),
  };
}

export function archivePeriodRefFromQuarter(
  year: number,
  quarter: 1 | 2 | 3 | 4,
  _locale?: string,
): ArchivePeriodRef {
  return {
    kind: 'quarter',
    year,
    quarter,
    label: formatTraceQuarterHeading(year, quarter),
  };
}

export function archivePeriodRefFromYear(year: number, _locale?: string): ArchivePeriodRef {
  return {
    kind: 'year',
    year,
    label: formatTraceYearHeading(year),
  };
}

export function archivePeriodRefFromDateKey(dateKey: string, locale?: string): ArchivePeriodRef {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  return archivePeriodRefFromMonth(year, month, locale);
}

export function archivePeriodRefFromNow(now: Date): {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  month: number;
  today: string;
} {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const today = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { year, quarter, month, today };
}

export function formatArchiveCombinedLabel(
  year: number,
  quarter: 1 | 2 | 3 | 4,
  month: number,
  locale?: string,
): { year: string; quarter: string; month: string; combined: string } {
  const monthLabel = formatCalendarMonthLabel(year, month, locale);
  const monthOnly = new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'long' });
  const quarterLabel = `Q${quarter}`;
  const yearLabel = String(year);
  return {
    year: yearLabel,
    quarter: quarterLabel,
    month: monthOnly,
    combined: `${yearLabel} · ${quarterLabel} · ${monthOnly}`,
  };
}
