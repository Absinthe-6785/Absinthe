import { describe, expect, it, vi } from 'vitest';
import {
  getTocScrollActiveIdx,
  getTocScrollDiagnostics,
  resetTocScrollDiagnostics,
  setTocScrollActiveIdx,
  subscribeTocScrollActiveIdx,
} from './tocScrollStore';

describe('tocScrollStore', () => {
  it('dedupes identical scroll index updates', () => {
    resetTocScrollDiagnostics();
    setTocScrollActiveIdx(2);
    setTocScrollActiveIdx(2);
    setTocScrollActiveIdx(2);
    expect(getTocScrollActiveIdx()).toBe(2);
    expect(getTocScrollDiagnostics().updateCount).toBe(1);
    expect(getTocScrollDiagnostics().skippedDuplicateCount).toBe(2);
  });

  it('notifies subscribers only on change', () => {
    resetTocScrollDiagnostics();
    const listener = vi.fn();
    subscribeTocScrollActiveIdx(listener);
    setTocScrollActiveIdx(1);
    setTocScrollActiveIdx(1);
    setTocScrollActiveIdx(3);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('simulates scroll frames without index change — zero store updates', () => {
    resetTocScrollDiagnostics();
    setTocScrollActiveIdx(5);
    for (let i = 0; i < 100; i++) {
      setTocScrollActiveIdx(5);
    }
    expect(getTocScrollDiagnostics().updateCount).toBe(1);
    expect(getTocScrollDiagnostics().skippedDuplicateCount).toBe(100);
  });
});
