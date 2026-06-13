import type { ArchiveBrowseProjection, ArchiveMarkCalendarProjection } from './archiveHomeModels';
import {
  archivePeriodRefFromMonth,
  archivePeriodRefFromNow,
  archivePeriodRefFromQuarter,
  archivePeriodRefFromYear,
} from './archivePeriodRefHelpers';

export function buildArchiveBrowseLinks(
  now: Date,
  markCalendar?: ArchiveMarkCalendarProjection,
): ArchiveBrowseProjection {
  const { year, quarter, month } = archivePeriodRefFromNow(now);
  const thisMonth = archivePeriodRefFromMonth(year, month);
  const thisQuarter = archivePeriodRefFromQuarter(year, quarter);
  const thisYear = archivePeriodRefFromYear(year);

  const yearsWithMarks = new Set<number>();
  for (const day of markCalendar?.days ?? []) {
    if (day.types.length > 0) {
      yearsWithMarks.add(Number(day.date.slice(0, 4)));
    }
  }

  const recentYearsWithMarks = [...yearsWithMarks]
    .sort((a, b) => b - a)
    .slice(0, 3)
    .map(y => archivePeriodRefFromYear(y));

  return {
    thisYear,
    thisQuarter,
    thisMonth,
    custom: { kind: 'custom', label: '사용자 지정' },
    allAreas: { kind: 'areas-index', label: '전체 영역' },
    timeline: {
      kind: 'timeline',
      defaultPeriod: thisMonth,
      label: '타임라인',
    },
    ...(recentYearsWithMarks.length > 0 ? { recentYearsWithMarks } : {}),
  };
}
