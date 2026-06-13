import type { ArchiveBrowseProjection, ArchiveMarkCalendarProjection } from './archiveHomeModels';
import { resolveArchiveBrowseStaticLabels } from './archiveBrowseLabels';
import {
  archivePeriodRefFromMonth,
  archivePeriodRefFromNow,
  archivePeriodRefFromQuarter,
  archivePeriodRefFromYear,
} from './archivePeriodRefHelpers';

export function buildArchiveBrowseLinks(
  now: Date,
  markCalendar?: ArchiveMarkCalendarProjection,
  locale?: string,
): ArchiveBrowseProjection {
  const { year, quarter, month } = archivePeriodRefFromNow(now);
  const staticLabels = resolveArchiveBrowseStaticLabels(locale);
  const thisMonth = archivePeriodRefFromMonth(year, month, locale);
  const thisQuarter = archivePeriodRefFromQuarter(year, quarter, locale);
  const thisYear = archivePeriodRefFromYear(year, locale);

  const yearsWithMarks = new Set<number>();
  for (const day of markCalendar?.days ?? []) {
    if (day.types.length > 0) {
      yearsWithMarks.add(Number(day.date.slice(0, 4)));
    }
  }

  const recentYearsWithMarks = [...yearsWithMarks]
    .sort((a, b) => b - a)
    .slice(0, 3)
    .map(y => archivePeriodRefFromYear(y, locale));

  return {
    thisYear,
    thisQuarter,
    thisMonth,
    custom: { kind: 'custom', label: staticLabels.custom },
    allAreas: { kind: 'areas-index', label: staticLabels.allAreas },
    timeline: {
      kind: 'timeline',
      defaultPeriod: thisMonth,
      label: staticLabels.timeline,
    },
    ...(recentYearsWithMarks.length > 0 ? { recentYearsWithMarks } : {}),
  };
}
