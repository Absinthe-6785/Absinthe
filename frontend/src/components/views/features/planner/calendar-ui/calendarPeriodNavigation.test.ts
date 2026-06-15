import { describe, expect, it } from 'vitest';
import { shiftPlannerAnchorDate } from './calendarPeriodNavigation';

describe('shiftPlannerAnchorDate', () => {
  it('shifts day anchors by one day', () => {
    expect(shiftPlannerAnchorDate('day', '2027-02-03', 1)).toBe('2027-02-04');
    expect(shiftPlannerAnchorDate('day', '2027-02-03', -1)).toBe('2027-02-02');
  });

  it('shifts week anchors by seven days', () => {
    expect(shiftPlannerAnchorDate('week', '2027-02-03', 1)).toBe('2027-02-10');
    expect(shiftPlannerAnchorDate('week', '2027-02-03', -1)).toBe('2027-01-27');
  });

  it('shifts month anchors by calendar month', () => {
    expect(shiftPlannerAnchorDate('month', '2027-02-15', 1)).toBe('2027-03-01');
    expect(shiftPlannerAnchorDate('month', '2027-02-15', -1)).toBe('2027-01-01');
  });

  it('returns null for invalid anchor dates', () => {
    expect(shiftPlannerAnchorDate('month', 'invalid', 1)).toBeNull();
  });
});
