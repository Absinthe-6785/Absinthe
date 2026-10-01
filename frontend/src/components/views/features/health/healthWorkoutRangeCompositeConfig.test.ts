import { describe, expect, it } from 'vitest';
import {
  HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED,
  isHealthWorkoutRangeCompositeEnabled,
} from './healthWorkoutRangeCompositeConfig';

describe('Workout range composite child gate', () => {
  it('is dormant by default', () => {
    expect(HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED).toBe(false);
    expect(isHealthWorkoutRangeCompositeEnabled({ healthActive: true, accountPresent: true })).toBe(false);
  });

  it.each([
    [false, false, false],
    [true, false, false],
    [false, true, false],
    [true, true, true],
  ])('requires parent=%s and child=%s', (parentEnabled, childEnabled, expected) => {
    expect(isHealthWorkoutRangeCompositeEnabled({
      parentEnabled, childEnabled, healthActive: true, accountPresent: true,
    })).toBe(expected);
  });

  it('also requires the Health surface and an account', () => {
    expect(isHealthWorkoutRangeCompositeEnabled({
      parentEnabled: true, childEnabled: true, healthActive: false, accountPresent: true,
    })).toBe(false);
    expect(isHealthWorkoutRangeCompositeEnabled({
      parentEnabled: true, childEnabled: true, healthActive: true, accountPresent: false,
    })).toBe(false);
  });
});
