import { describe, expect, it } from 'vitest';
import { isDuplicatedWeeklyTitle } from './k101TimetableDuplicateDays';
import type { WeeklySchedule } from '../../types';

function sch(id: string, title: string, day: number): WeeklySchedule {
  return {
    id,
    day,
    title,
    start_time: '09:00',
    end_time: '10:00',
    color: 'bg-sky-600',
  };
}

describe('k101TimetableDuplicateDays', () => {
  it('detects duplicated titles across weekdays', () => {
    const list = [sch('1', 'Yoga', 0), sch('2', 'Yoga', 2)];
    expect(isDuplicatedWeeklyTitle(list[0]!, list)).toBe(true);
    expect(isDuplicatedWeeklyTitle(sch('3', 'Run', 1), list)).toBe(false);
  });
});
