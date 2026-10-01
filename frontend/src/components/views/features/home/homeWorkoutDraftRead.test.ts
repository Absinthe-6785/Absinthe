import { describe, expect, it, vi } from 'vitest';
import { readHomeWorkoutDraft } from './homeWorkoutDraftRead';

describe('getItem-only Home draft facade', () => {
  it.each([null, '[]'])('distinguishes absent %s', raw => {
    expect(readHomeWorkoutDraft({ getItem: () => raw }, 'a', '2026-10-01').status).toBe('absent');
  });
  it.each(['{broken', '{}', 'null', '[null]', '[{"block_id":"x","sets":[{"done":1}]}]'])
  ('preserves malformed/non-array bytes %s', raw => {
    const storage = { getItem: vi.fn(() => raw), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
    expect(readHomeWorkoutDraft(storage, 'a', '2026-10-01').status).toBe('unavailable');
    expect(storage.getItem).toHaveBeenCalledWith('healthDraft:a:2026-10-01');
    expect(storage.setItem).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled(); expect(storage.getItem()).toBe(raw);
  });
  it('reports unreadable storage without throwing or repairing it', () => {
    expect(readHomeWorkoutDraft({ getItem: () => { throw new Error('denied'); } }, 'a', 'today').status).toBe('unavailable');
  });
  it('counts validated draft occurrences without adding persisted evidence', () => {
    const raw = JSON.stringify([{ block_id: 'bench', sets: [{ done: false }, { done: true }] },
      { block_id: 'bench', sets: [] }, { block_id: '__session__', sets: [] }]);
    expect(readHomeWorkoutDraft({ getItem: () => raw }, 'a', 'today')).toMatchObject({
      status: 'present', counts: { exerciseCount: 2, setCount: 2, doneCount: 1 },
    });
  });
  it('keeps separator-only unsaved buffer present with zero counts', () => {
    expect(readHomeWorkoutDraft({ getItem: () => '[{"block_id":"__session__","sets":[]}]' }, 'a', 'today'))
      .toMatchObject({ status: 'present', counts: { exerciseCount: 0, setCount: 0, doneCount: 0 } });
  });
});
