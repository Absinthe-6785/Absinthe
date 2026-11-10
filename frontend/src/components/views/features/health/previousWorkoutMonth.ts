import { resolveIntlLocale, type Language } from '../../../../lib/i18n';

export type PreviousWorkoutMonthOption = Readonly<{
  month: string;
  latestDate: string;
}>;

/** Validate date-only keys without parsing them as UTC timestamps. */
export function isPreviousWorkoutDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1]!;
}

/** Derive only months represented by the already-qualified date source. */
export function listPreviousWorkoutMonthOptions(
  dates: readonly string[],
): PreviousWorkoutMonthOption[] {
  const latestDateByMonth = new Map<string, string>();
  for (const date of dates) {
    if (!isPreviousWorkoutDateKey(date)) continue;
    const month = date.slice(0, 7);
    const latestDate = latestDateByMonth.get(month);
    if (!latestDate || date > latestDate) latestDateByMonth.set(month, date);
  }
  return [...latestDateByMonth]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([month, latestDate]) => ({ month, latestDate }));
}

export function listPreviousWorkoutDatesInMonth(
  dates: readonly string[],
  month: string,
): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  return [...new Set(dates.filter(date => isPreviousWorkoutDateKey(date) && date.slice(0, 7) === month))]
    .sort((left, right) => right.localeCompare(left));
}

/** Keep the selected date's month visible; fall back to the latest known date if it vanished. */
export function resolvePreviousWorkoutMonth(
  dates: readonly string[],
  selectedDate: string | null,
): string | null {
  const availableDates = new Set(dates.filter(isPreviousWorkoutDateKey));
  if (selectedDate && availableDates.has(selectedDate)) return selectedDate.slice(0, 7);
  return [...availableDates].sort((left, right) => right.localeCompare(left))[0]?.slice(0, 7) ?? null;
}

export function formatPreviousWorkoutMonth(month: string, language: Language): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return month;
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString(resolveIntlLocale(language), { year: 'numeric', month: 'long' });
}
