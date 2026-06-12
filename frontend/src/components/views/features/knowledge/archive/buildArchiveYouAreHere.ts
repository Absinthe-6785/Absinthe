import {
  archivePeriodRefFromMonth,
  archivePeriodRefFromNow,
  archivePeriodRefFromQuarter,
  archivePeriodRefFromYear,
  formatArchiveCombinedLabel,
} from './archivePeriodRefHelpers';
import type { ArchiveYouAreHere } from './archiveHomeModels';

export function buildArchiveYouAreHere(now: Date, locale?: string): ArchiveYouAreHere {
  const { year, quarter, month, today } = archivePeriodRefFromNow(now);
  const labels = formatArchiveCombinedLabel(year, quarter, month, locale);

  return {
    today,
    year,
    quarter,
    month,
    labels,
    openPeriod: archivePeriodRefFromMonth(year, month),
  };
}
