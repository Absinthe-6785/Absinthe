import { describe, expect, it, vi } from 'vitest';
import {
  captureHealthWorkoutOperationScope as capture,
  createHealthWorkoutOperationAuthority as issue,
  isCurrentHealthWorkoutOperationScope as current,
  type HealthWorkoutOperationScope,
} from './healthWorkoutOperationScope';

const A = Object.freeze({ accountId: 'account-a', generation: 3 });
const X = '2026-08-24', Y = '2026-08-25';
const accountCurrent = (a: typeof A) => a.accountId === A.accountId && a.generation === A.generation;

describe('shared workout operation capture/currentness', () => {
  it('ABA0-C11 all five product gates remain literal false with no override', async () => {
    const { readFileSync } = await import('node:fs');
    for (const [path, gate] of [
      ['health/healthSelectedDayCompositeConfig', 'HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED'],
      ['health/healthWorkoutRangeCompositeConfig', 'HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED'],
      ['health/healthExerciseComparisonPreviewConfig', 'HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED'],
      ['home/homeWorkoutCompositeConfig', 'HOME_WORKOUT_COMPOSITE_READER_ENABLED'],
      ['search/searchWorkoutCompositeConfig', 'SEARCH_WORKOUT_COMPOSITE_READER_ENABLED'],
    ]) {
      const source = readFileSync('src/components/views/features/' + path + '.ts', 'utf8');
      expect(source).toMatch(new RegExp('export const ' + gate + ' = false;'));
      expect(source).not.toMatch(/import\.meta\.env|process\.env|localStorage|sessionStorage/);
    }
  });
  it('S01 D01 ABA0-C01/C06 captures frozen snapshots in a valid current lifetime', () => {
    const authority = issue(A, X)!;
    const sourceAccount = { ...A };
    const scope = capture(authority, sourceAccount, X, authority, accountCurrent)!;
    expect(current(scope, authority, accountCurrent)).toBe(true);
    expect(scope.accountOperation).not.toBe(sourceAccount);
    expect(Object.isFrozen(scope)).toBe(true);
    expect(Object.isFrozen(scope.accountOperation)).toBe(true);
    expect(Object.isFrozen(scope.dateLifetime)).toBe(true);
    sourceAccount.generation++;
    expect(scope.accountOperation.generation).toBe(3);
  });
  it.each(['Save', 'Delete'])('S02/D02 S03/D03 denies late %s across X1/Y/X2', async () => {
    const x1 = issue(A, X)!, scope = capture(x1, A, X, x1, accountCurrent)!;
    const y = issue(A, Y)!, x2 = issue(A, X)!, effect = vi.fn();
    expect(current(scope, y, accountCurrent)).toBe(false);
    expect(current(scope, x2, accountCurrent)).toBe(false);
    expect(x1.dateLifetime).not.toBe(x2.dateLifetime);
    await Promise.resolve().then(() => { if (current(scope, x2, accountCurrent)) effect(); });
    expect(effect).not.toHaveBeenCalled();
    expect(capture(x1, A, X, x2, accountCurrent)).toBeNull();
    expect(capture(x2, A, X, x2, accountCurrent)).not.toBeNull();
  });
  it('S04 D04 R06 preserves independent account generation and retirement', () => {
    const x1 = issue(A, X)!, scope = capture(x1, A, X, x1, accountCurrent)!;
    expect(current(scope, x1, () => false)).toBe(false);
    expect(current(scope, issue({ ...A, generation: 5 }, X), () => true)).toBe(false);
    expect(current(scope, null, accountCurrent)).toBe(false);
    expect(capture(x1, { ...A, generation: 5 }, X, x1, () => true)).toBeNull();
  });
  it('S08 denies null/mismatched publication, malformed, foreign and missing lifetimes', () => {
    const auth = issue(A, X)!;
    expect(capture(null, A, X, auth, accountCurrent)).toBeNull();
    expect(capture(auth, A, Y, auth, accountCurrent)).toBeNull();
    expect(capture(auth, A, X, null, accountCurrent)).toBeNull();
    expect(capture(auth, A, X, auth, () => false)).toBeNull();
    // @ts-expect-error A missing lifetime is not a supported compatibility signature.
    const missing: HealthWorkoutOperationScope = { accountOperation: A, dateKey: X };
    expect(current(missing, auth, accountCurrent)).toBe(false);
    expect(current({ ...auth, dateLifetime: Object.freeze({}) } as HealthWorkoutOperationScope, auth, accountCurrent)).toBe(false);
    expect(current({ ...auth, dateKey: Y }, auth, accountCurrent)).toBe(false);
    expect(current({ ...auth, accountOperation: { ...A, generation: 2 } }, auth, accountCurrent)).toBe(false);
    expect(current(null as unknown as HealthWorkoutOperationScope, auth, accountCurrent)).toBe(false);
  });
  it.each(['', '2026-02-30', 'not-a-date'])('invalid date %s never issues authority', date => {
    expect(issue(A, date)).toBeNull();
  });
  it('invalid account/generation never issues authority', () => {
    expect(issue({ accountId: '', generation: 0 }, X)).toBeNull();
    expect(issue({ ...A, generation: NaN }, X)).toBeNull();
    expect(issue({ ...A, generation: -1 }, X)).toBeNull();
  });
});
