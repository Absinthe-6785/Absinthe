import type {
  PlannerCalendarPresentation,
  PlannerCalendarPresentationLabels,
  PlannerCalendarProjection,
  PlannerLocale,
} from './calendarModels';
import { isoWeekBounds } from './plannerCalendarDateUtils';
import { parseDateKey } from '../../knowledge/databaseViews/parseDatabaseDate';

function resolveIntlLocale(locale: PlannerLocale): string {
  return locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US';
}

export function formatPlannerCountdownLabel(daysUntil: number, _locale: PlannerLocale): string {
  if (daysUntil === 0) return 'D-Day';
  if (daysUntil > 0) return `D-${daysUntil}`;
  return `D+${Math.abs(daysUntil)}`;
}

export function formatPlannerMonthTitle(
  year: number,
  month: number,
  locale: PlannerLocale,
): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(resolveIntlLocale(locale), {
    month: 'long',
    year: 'numeric',
  });
}

export function formatPlannerWeekRangeLabel(
  startDate: string,
  endDate: string,
  locale: PlannerLocale,
): string {
  const startParts = parseDateKey(startDate);
  const endParts = parseDateKey(endDate);
  if (!startParts || !endParts) return `${startDate} – ${endDate}`;

  const start = new Date(startParts.year, startParts.month - 1, startParts.day);
  const end = new Date(endParts.year, endParts.month - 1, endParts.day);
  const intl = resolveIntlLocale(locale);

  const sameYear = startParts.year === endParts.year;
  const sameMonth = sameYear && startParts.month === endParts.month;

  if (sameMonth) {
    const monthPart = start.toLocaleDateString(intl, { month: 'short', year: 'numeric' });
    return `${monthPart.replace(String(startParts.year), '').trim()} ${startParts.day} – ${endParts.day}, ${startParts.year}`.replace(/\s+/g, ' ').trim();
  }

  const startLabel = start.toLocaleDateString(intl, { month: 'short', day: 'numeric', year: 'numeric' });
  const endLabel = end.toLocaleDateString(intl, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

export function formatPlannerDayHeading(dateKey: string, locale: PlannerLocale): string {
  const parts = parseDateKey(dateKey);
  if (!parts) return dateKey;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  return date.toLocaleDateString(resolveIntlLocale(locale), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatPlannerWeekdayShort(weekday: number, locale: PlannerLocale): string {
  const monday = new Date(2026, 5, 1 + weekday);
  return monday.toLocaleDateString(resolveIntlLocale(locale), { weekday: 'short' });
}

export function formatPlannerAgendaDateHeader(dateKey: string, locale: PlannerLocale): string {
  return formatPlannerDayHeading(dateKey, locale);
}

export function formatPlannerCalendarPresentation(
  projection: PlannerCalendarProjection,
  locale: PlannerLocale,
): PlannerCalendarPresentation {
  const month = projection.views.month;
  const week = projection.views.week;
  const labels: PlannerCalendarPresentationLabels = {
    monthTitle: month.year && month.month
      ? formatPlannerMonthTitle(month.year, month.month, locale)
      : '',
    weekRangeLabel: week.startDate && week.endDate
      ? formatPlannerWeekRangeLabel(week.startDate, week.endDate, locale)
      : '',
    dayHeading: formatPlannerDayHeading(projection.meta.anchorDate, locale),
    weekdayShortLabels: [0, 1, 2, 3, 4, 5, 6].map(day => formatPlannerWeekdayShort(day, locale)),
    agendaHorizonLabel: projection.views.agenda.horizon.startDate && projection.views.agenda.horizon.endDate
      ? formatPlannerWeekRangeLabel(
        projection.views.agenda.horizon.startDate,
        projection.views.agenda.horizon.endDate,
        locale,
      )
      : '',
    countdownLabels: new Map(
      projection.core.countdowns.map(countdown => [
        countdown.id,
        formatPlannerCountdownLabel(countdown.daysUntil, locale),
      ]),
    ),
    agendaDateHeaders: new Map(
      projection.views.agenda.dayGroups.map(group => [
        group.dateKey,
        formatPlannerAgendaDateHeader(group.dateKey, locale),
      ]),
    ),
  };

  return { locale, labels };
}

export function resolvePlannerLocale(language: string | undefined): PlannerLocale {
  if (language === 'ko') return 'ko';
  if (language === 'ja') return 'ja';
  return 'en';
}

/** Convenience for week label when only anchor date known */
export function formatPlannerWeekRangeFromAnchor(anchorDate: string, locale: PlannerLocale): string {
  const week = isoWeekBounds(anchorDate);
  if (!week) return anchorDate;
  return formatPlannerWeekRangeLabel(week.startDate, week.endDate, locale);
}
