import type { TranslationKey } from '../../lib/i18n';
import type { RelativeDateLabels } from './k102DateFormat';

export function buildRelativeDateLabels(
  t: (key: TranslationKey) => string,
): RelativeDateLabels {
  return {
    today: t('nvToday'),
    yesterday: t('nvYesterday'),
    daysAgo: count => t('k102DaysAgo').replace('{count}', String(count)),
  };
}
