import type { TranslationKey } from '../../lib/i18n';
import type { CohesionGroupLabels, RelativeDateLabels } from './k102DateFormat';

export function buildRelativeDateLabels(
  t: (key: TranslationKey) => string,
): RelativeDateLabels {
  return {
    today: t('nvToday'),
    yesterday: t('nvYesterday'),
    daysAgo: count => t('k102DaysAgo').replace('{count}', String(count)),
  };
}

/** K-113 — unified group headings across domains. */
export function buildCohesionGroupLabels(
  t: (key: TranslationKey) => string,
): CohesionGroupLabels {
  return {
    today: t('k109HistoryToday'),
    yesterday: t('k109HistoryYesterday'),
    thisWeek: t('k113ThisWeek'),
    earlier: t('k113Earlier'),
  };
}
