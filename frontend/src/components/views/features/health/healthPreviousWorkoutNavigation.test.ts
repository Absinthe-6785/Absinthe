import { describe, expect, it } from 'vitest';
import { parseHealthLocalDateKey, startOfHealthLocalMonth } from './healthPreviousWorkoutNavigation';

describe('Health Previous date navigation', () => {
  it('parses a valid date-only key without shifting the local calendar day', () => {
    const date = parseHealthLocalDateKey('2026-01-03');
    expect(date).not.toBeNull();
    expect([date!.getFullYear(), date!.getMonth(), date!.getDate()]).toEqual([2026, 0, 3]);
    expect([startOfHealthLocalMonth(date!).getFullYear(), startOfHealthLocalMonth(date!).getMonth(), startOfHealthLocalMonth(date!).getDate()])
      .toEqual([2026, 0, 1]);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-01-00', '2026-1-03', 'not-a-date'])
    ('rejects invalid date key %s', value => {
      expect(parseHealthLocalDateKey(value)).toBeNull();
    });
});
