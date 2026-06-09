import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDragStateSnapshot,
  resetDragStateStore,
  setDragStateStore,
  subscribeDragState,
  updateDragStateOver,
} from './dragStateStore';

describe('dragStateStore', () => {
  afterEach(() => {
    resetDragStateStore();
  });

  it('notifies subscribers on drag start and end', () => {
    const listener = vi.fn();
    subscribeDragState(listener);

    setDragStateStore({ draggingIds: ['a'], overId: null, overPos: null });
    expect(getDragStateSnapshot()?.draggingIds).toEqual(['a']);
    expect(listener).toHaveBeenCalledTimes(1);

    setDragStateStore(null);
    expect(getDragStateSnapshot()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('skips emit when over target is unchanged', () => {
    setDragStateStore({ draggingIds: ['a'], overId: 'b', overPos: 'before' });
    const listener = vi.fn();
    subscribeDragState(listener);

    updateDragStateOver('b', 'before');
    expect(listener).not.toHaveBeenCalled();

    updateDragStateOver('b', 'after');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getDragStateSnapshot()?.overPos).toBe('after');
  });
});
