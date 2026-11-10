import { describe, expect, it } from 'vitest';
import { getTranslator } from '../../../../lib/i18n';
import {
  formatPreviousWorkoutMonth,
  isPreviousWorkoutDateKey,
  listPreviousWorkoutDatesInMonth,
  listPreviousWorkoutMonthOptions,
  resolvePreviousWorkoutMonth,
} from './previousWorkoutMonth';

describe('Previous Workout month derivation', () => {
  const dates = ['2026-08-03', '2027-01-02', '2026-12-31', '2026-08-30', '2026-08-30'];

  it('offers only represented months in descending year/month order with each latest known date', () => {
    expect(listPreviousWorkoutMonthOptions(dates)).toEqual([
      { month: '2027-01', latestDate: '2027-01-02' },
      { month: '2026-12', latestDate: '2026-12-31' },
      { month: '2026-08', latestDate: '2026-08-30' },
    ]);
  });

  it('lists only the selected month dates in descending order and handles a December-January boundary', () => {
    expect(listPreviousWorkoutDatesInMonth(dates, '2026-08')).toEqual(['2026-08-30', '2026-08-03']);
    expect(listPreviousWorkoutDatesInMonth(dates, '2026-12')).toEqual(['2026-12-31']);
    expect(listPreviousWorkoutDatesInMonth(dates, '2027-01')).toEqual(['2027-01-02']);
  });

  it('derives the month from an available selected date and falls back after source replacement', () => {
    expect(resolvePreviousWorkoutMonth(dates, '2026-08-03')).toBe('2026-08');
    expect(resolvePreviousWorkoutMonth(['2025-12-09', '2025-12-22'], '2026-08-03')).toBe('2025-12');
    expect(resolvePreviousWorkoutMonth([], '2026-08-03')).toBeNull();
  });

  it('rejects malformed calendar dates without converting valid local date keys through UTC', () => {
    expect(isPreviousWorkoutDateKey('2024-02-29')).toBe(true);
    expect(isPreviousWorkoutDateKey('2025-02-29')).toBe(false);
    expect(isPreviousWorkoutDateKey('2026-13-01')).toBe(false);
    expect(isPreviousWorkoutDateKey('2026-08-01T00:00:00Z')).toBe(false);
    expect(listPreviousWorkoutMonthOptions(['2026-08-03T00:00:00Z', '2026-99-99'])).toEqual([]);
  });

  it.each([
    ['en', 'Month', 'August 2026'],
    ['ko', '월', '2026년 8월'],
    ['ja', '月', '2026年8月'],
  ] as const)('uses localized month controls and month/year option text for %s', (language, label, expectedMonth) => {
    expect(getTranslator(language)('k42ViewMonth')).toBe(label);
    expect(formatPreviousWorkoutMonth('2026-08', language)).toBe(expectedMonth);
  });
});
