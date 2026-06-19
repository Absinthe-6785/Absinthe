import type { TranslationKey } from '@/lib/i18n';
import { addDays, daysBetween } from '../../calendar/plannerCalendarDateUtils';
import type { UpcomingAgendaGroup } from './buildUpcomingAgendaGroups';

export type UpcomingTier = 'today' | 'tomorrow' | 'later';

export interface UpcomingTierSection {
  tier: UpcomingTier;
  tierLabel: string;
  days: readonly UpcomingAgendaGroup[];
}

export function resolveUpcomingRelativeLabel(
  dateKey: string,
  todayKey: string,
  t: (key: TranslationKey) => string,
): string {
  if (dateKey === todayKey) return t('nvToday');
  const tomorrowKey = addDays(todayKey, 1);
  if (tomorrowKey && dateKey === tomorrowKey) return t('k101Tomorrow');
  const diff = daysBetween(todayKey, dateKey);
  if (diff != null && diff > 1) {
    return t('k108InDays').replace('{count}', String(diff));
  }
  return dateKey;
}

/** Bucket upcoming days into Today / Tomorrow / Later — K-108. */
export function buildUpcomingTierGroups(
  groups: readonly UpcomingAgendaGroup[],
  todayKey: string,
  relativeLabel: (dateKey: string) => string,
  laterTierLabel = 'Later',
): UpcomingTierSection[] {
  const tomorrowKey = addDays(todayKey, 1);
  const todayDays: UpcomingAgendaGroup[] = [];
  const tomorrowDays: UpcomingAgendaGroup[] = [];
  const laterDays: UpcomingAgendaGroup[] = [];

  for (const group of groups) {
    const relabeled = { ...group, dateLabel: relativeLabel(group.dateKey) };
    if (group.dateKey === todayKey) todayDays.push(relabeled);
    else if (tomorrowKey && group.dateKey === tomorrowKey) tomorrowDays.push(relabeled);
    else laterDays.push(relabeled);
  }

  const sections: UpcomingTierSection[] = [];
  if (todayDays.length > 0) {
    sections.push({ tier: 'today', tierLabel: relativeLabel(todayKey), days: todayDays });
  }
  if (tomorrowDays.length > 0 && tomorrowKey) {
    sections.push({ tier: 'tomorrow', tierLabel: relativeLabel(tomorrowKey), days: tomorrowDays });
  }
  if (laterDays.length > 0) {
    sections.push({ tier: 'later', tierLabel: laterTierLabel, days: laterDays });
  }
  return sections;
}

export function buildUpcomingTierGroupsWithT(
  groups: readonly UpcomingAgendaGroup[],
  todayKey: string,
  t: (key: TranslationKey) => string,
): UpcomingTierSection[] {
  const rel = (dateKey: string) => resolveUpcomingRelativeLabel(dateKey, todayKey, t);
  const sections = buildUpcomingTierGroups(groups, todayKey, rel);
  return sections.map(section => (
    section.tier === 'later'
      ? { ...section, tierLabel: t('k108Later') }
      : section
  ));
}
