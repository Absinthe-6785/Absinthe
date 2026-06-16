import { describe, expect, it, vi } from 'vitest';
import { resetRenderDiagnostics, getRenderDiagnostics } from './renderDiagnostics';
import { resetTocScrollDiagnostics, setTocScrollActiveIdx, getTocScrollDiagnostics } from './tocScrollStore';

/**
 * K-92A1 — documents expected render propagation reduction.
 * Before: scroll spy called setActiveTocIdx → NoteView + childPropInput invalidation.
 * After: store updates skip NoteView; only NoteContextTocOutline subscribes.
 */
describe('K-92A1 render propagation model', () => {
  it('100 scroll frames at same heading → 1 store update, 99 deduped', () => {
    resetTocScrollDiagnostics();
    setTocScrollActiveIdx(12);
    for (let i = 0; i < 99; i++) {
      setTocScrollActiveIdx(12);
    }
    const d = getTocScrollDiagnostics();
    expect(d.updateCount).toBe(1);
    expect(d.skippedDuplicateCount).toBe(99);
  });

  it('heading boundary crosses → one update per boundary', () => {
    resetTocScrollDiagnostics();
    const headings = [0, 0, 0, 1, 1, 2, 2, 2];
    for (const idx of headings) {
      setTocScrollActiveIdx(idx);
    }
    expect(getTocScrollDiagnostics().updateCount).toBe(3);
  });

  it('render diagnostics reset is clean', () => {
    resetRenderDiagnostics();
    expect(getRenderDiagnostics()).toEqual({});
  });
});

describe('useTocScrollSpy dedup contract', () => {
  it('spy callback receives only changed indices (simulated)', () => {
    const onActiveIdx = vi.fn();
    let lastIdx: number | null = null;
    const simulateSpyUpdate = (next: number | null) => {
      if (next === lastIdx) return;
      lastIdx = next;
      onActiveIdx(next);
    };

    for (let frame = 0; frame < 60; frame++) {
      simulateSpyUpdate(3);
    }
    simulateSpyUpdate(4);
    simulateSpyUpdate(4);

    expect(onActiveIdx).toHaveBeenCalledTimes(2);
    expect(onActiveIdx).toHaveBeenNthCalledWith(1, 3);
    expect(onActiveIdx).toHaveBeenNthCalledWith(2, 4);
  });
});
