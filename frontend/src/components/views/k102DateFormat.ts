import type { Language } from '../../lib/i18n';
import { resolveIntlLocale } from '../../lib/i18n';
import { parseDateKey, toDateKey } from './features/knowledge/databaseViews/parseDatabaseDate';

export type RelativeDateLabelKey =
  | 'today'
  | 'yesterday'
  | 'daysAgo'
  | 'sameYear'
  | 'otherYear';

export interface RelativeDateLabels {
  today: string;
  yesterday: string;
  daysAgo: (count: number) => string;
}

export interface FormatRelativeDateOptions {
  /** Epoch ms or YYYY-MM-DD date key. */
  value: number | string;
  /** Anchor calendar day as YYYY-MM-DD (local). */
  todayKey: string;
  locale?: Language | null;
  labels: RelativeDateLabels;
  /** Include time for same-day timestamps (activity rows). */
  includeTime?: boolean;
}

const MS_PER_DAY = 86_400_000;

function startOfDayMs(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00`).getTime();
}

function toDateKeyFromMs(ms: number): string {
  const d = new Date(ms);
  return toDateKey(d);
}

function calendarDayDiff(fromKey: string, toKey: string): number {
  return Math.round((startOfDayMs(toKey) - startOfDayMs(fromKey)) / MS_PER_DAY);
}

export function formatAbsoluteDateKey(
  dateKey: string,
  locale?: Language | null,
  options?: { includeYear?: boolean },
): string {
  const parts = parseDateKey(dateKey);
  if (!parts) return dateKey;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  const intl = resolveIntlLocale(locale);
  const nowYear = new Date().getFullYear();
  const includeYear = options?.includeYear ?? parts.year !== nowYear;
  return date.toLocaleDateString(intl, includeYear
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' });
}

export function formatTraceDayHeadingLocalized(
  dateKey: string,
  locale?: Language | null,
): string {
  return formatAbsoluteDateKey(dateKey, locale, { includeYear: true });
}

export function classifyRelativeDate(
  valueMs: number,
  todayKey: string,
): RelativeDateLabelKey {
  const valueKey = toDateKeyFromMs(valueMs);
  const diff = calendarDayDiff(valueKey, todayKey);
  if (diff < 0) {
    const parts = parseDateKey(valueKey);
    const todayParts = parseDateKey(todayKey);
    if (!parts || !todayParts) return 'otherYear';
    return parts.year === todayParts.year ? 'sameYear' : 'otherYear';
  }
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff > 1 && diff <= 7) return 'daysAgo';
  const parts = parseDateKey(valueKey);
  const todayParts = parseDateKey(todayKey);
  if (!parts || !todayParts) return 'otherYear';
  if (parts.year === todayParts.year) return 'sameYear';
  return 'otherYear';
}

export function formatRelativeDate({
  value,
  todayKey,
  locale,
  labels,
  includeTime = false,
}: FormatRelativeDateOptions): string {
  const valueMs = typeof value === 'string' ? startOfDayMs(value) : value;
  const valueKey = typeof value === 'string' ? value : toDateKeyFromMs(valueMs);
  const intl = resolveIntlLocale(locale);
  const kind = classifyRelativeDate(valueMs, todayKey);

  if (kind === 'today') {
    if (includeTime && typeof value === 'number') {
      const time = new Date(valueMs).toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' });
      return `${labels.today} ${time}`;
    }
    return labels.today;
  }
  if (kind === 'yesterday') return labels.yesterday;
  if (kind === 'daysAgo') {
    const days = calendarDayDiff(valueKey, todayKey);
    return labels.daysAgo(days);
  }
  if (kind === 'sameYear') return formatAbsoluteDateKey(valueKey, locale, { includeYear: false });
  return formatAbsoluteDateKey(valueKey, locale, { includeYear: true });
}

export function formatAgendaDateHeader(
  dateKey: string,
  todayKey: string,
  locale: Language | null | undefined,
  labels: RelativeDateLabels,
): string {
  return formatRelativeDate({ value: dateKey, todayKey, locale, labels });
}

export function formatNoteRowDate(
  updatedAt: number,
  todayKey: string,
  locale: Language | null | undefined,
  labels: RelativeDateLabels,
): string {
  return formatRelativeDate({ value: updatedAt, todayKey, locale, labels });
}

export function formatActivityTimestamp(
  timestamp: number,
  todayKey: string,
  locale: Language | null | undefined,
  labels: RelativeDateLabels,
): string {
  return formatRelativeDate({
    value: timestamp,
    todayKey,
    locale,
    labels,
    includeTime: true,
  });
}
