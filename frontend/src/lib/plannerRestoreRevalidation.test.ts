import { describe, expect, it } from 'vitest';
import { shouldRevalidatePlannerAfterRestore } from './plannerRestoreRevalidation';

describe('Planner restore revalidation boundary', () => {
  const current = {
    initiatingAccountId: 'account-a',
    currentAccountId: 'account-a',
    initiatingGeneration: 3,
    currentGeneration: 3,
  };

  it('revalidates the current account after an applied cloud restore', () => {
    expect(shouldRevalidatePlannerAfterRestore({ ...current, cloudApplied: true })).toBe(true);
  });

  it('does not revalidate when the cloud restore was not applied', () => {
    expect(shouldRevalidatePlannerAfterRestore({ ...current, cloudApplied: false })).toBe(false);
    expect(shouldRevalidatePlannerAfterRestore({ ...current, cloudApplied: undefined })).toBe(false);
  });

  it('does not revalidate after an account transition during restore', () => {
    expect(shouldRevalidatePlannerAfterRestore({
      ...current,
      cloudApplied: true,
      currentAccountId: 'account-b',
      currentGeneration: 4,
    })).toBe(false);
  });
});
