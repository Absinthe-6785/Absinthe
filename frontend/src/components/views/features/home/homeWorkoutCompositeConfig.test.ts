import { describe, expect, it } from 'vitest';
import { HOME_WORKOUT_COMPOSITE_READER_ENABLED, isHomeWorkoutCompositeEnabled } from './homeWorkoutCompositeConfig';

describe('Home preview static child gate', () => {
  it('ships OFF and requires parent, child, active Home and account', () => {
    expect(HOME_WORKOUT_COMPOSITE_READER_ENABLED).toBe(false);
    const eligible = { parentEnabled: true, childEnabled: true, homeActive: true, accountPresent: true };
    expect(isHomeWorkoutCompositeEnabled(eligible)).toBe(true);
    for (const key of Object.keys(eligible)) expect(isHomeWorkoutCompositeEnabled({ ...eligible, [key]: false })).toBe(false);
    expect(isHomeWorkoutCompositeEnabled({ homeActive: true, accountPresent: true })).toBe(false);
  });
});
