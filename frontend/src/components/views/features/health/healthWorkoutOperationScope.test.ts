import { describe, expect, it, vi } from 'vitest';
import {
  isCurrentHealthWorkoutOperationScope,
  type HealthWorkoutOperationScope,
} from './healthWorkoutOperationScope';

const accountA = { accountId: 'account-a', generation: 3 };
const accountB = { accountId: 'account-b', generation: 4 };

function scope(accountOperation = accountA, dateKey = '2026-08-24'): HealthWorkoutOperationScope {
  return { accountOperation, dateKey };
}

describe('health workout operation scope', () => {
  it('blocks a delayed save completion after a date switch', async () => {
    let currentDateKey = '2026-08-24';
    const commit = vi.fn();
    const pending = Promise.resolve().then(() => {
      if (isCurrentHealthWorkoutOperationScope(scope(), currentDateKey, token => token === accountA)) commit();
    });

    currentDateKey = '2026-08-25';
    await pending;

    expect(commit).not.toHaveBeenCalled();
  });

  it('blocks a delayed save completion after an account switch', async () => {
    let currentAccount = accountA;
    const commit = vi.fn();
    const pending = Promise.resolve().then(() => {
      if (isCurrentHealthWorkoutOperationScope(scope(), '2026-08-24', token => token === currentAccount)) commit();
    });

    currentAccount = accountB;
    await pending;

    expect(commit).not.toHaveBeenCalled();
  });

  it('blocks a delayed delete completion after a date switch', async () => {
    let currentDateKey = '2026-08-24';
    const workouts = ['date-2-workout'];
    const pending = Promise.resolve().then(() => {
      if (isCurrentHealthWorkoutOperationScope(scope(), currentDateKey, token => token === accountA)) workouts.splice(0);
    });

    currentDateKey = '2026-08-25';
    await pending;

    expect(workouts).toEqual(['date-2-workout']);
  });
});
