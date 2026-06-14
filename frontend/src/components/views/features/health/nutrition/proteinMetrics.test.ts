import { describe, expect, it } from 'vitest';
import {
  computeProteinProgress,
  computeProteinStreak,
  computeWeeklyProteinAverage,
  sumProteinIntake,
} from './proteinMetrics';
import type { ProteinIntakeLog } from '../../../../types';

describe('proteinMetrics', () => {
  const logs: ProteinIntakeLog[] = [
    { id: '1', protein_g: 25 },
    { id: '2', protein_g: 30.5 },
  ];

  it('sums intake', () => {
    expect(sumProteinIntake(logs)).toBe(55.5);
  });

  it('computes progress capped at 100', () => {
    expect(computeProteinProgress(80, 100)).toBe(80);
    expect(computeProteinProgress(150, 100)).toBe(100);
  });

  it('computes weekly average', () => {
    expect(computeWeeklyProteinAverage([80, 100, 90])).toBe(90);
  });

  it('computes protein streak ending at anchor date', () => {
    const map = new Map([
      ['2026-06-14', 120],
      ['2026-06-13', 110],
      ['2026-06-12', 50],
    ]);
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);
    expect(computeProteinStreak(map, 100, '2026-06-14', formatDate)).toBe(2);
  });
});
