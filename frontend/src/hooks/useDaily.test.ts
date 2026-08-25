import { describe, expect, it } from 'vitest';
import { getDailyDataLoading } from './useDaily';

describe('daily data loading semantics', () => {
  it('does not report Health startup readiness as daily loading in local mode', () => {
    expect(getDailyDataLoading(true, false, [false, false, false, false, false])).toBe(false);
  });

  it('reports an actual local Health read while it is loading', () => {
    expect(getDailyDataLoading(true, false, [false, false, false, false, false])).toBe(false);
    expect(getDailyDataLoading(true, true, [false, false, false, false, false])).toBe(true);
  });

  it('retains the remote daily loading aggregate outside local mode', () => {
    expect(getDailyDataLoading(false, true, [false, false, true, false, false])).toBe(true);
    expect(getDailyDataLoading(false, true, [false, false, false, false, false])).toBe(false);
  });
});
