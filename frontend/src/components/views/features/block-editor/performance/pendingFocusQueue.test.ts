import { describe, expect, it } from 'vitest';
import { PendingFocusQueue } from './pendingFocusQueue';

describe('PendingFocusQueue', () => {
  it('queues and consumes focus for matching block id', () => {
    const queue = new PendingFocusQueue();
    queue.queueFocus({ blockId: 'a', offset: 'start' });
    expect(queue.peek()?.blockId).toBe('a');
    const consumed = queue.consumePendingFocus('a');
    expect(consumed).toEqual({ blockId: 'a', offset: 'start' });
    expect(queue.peek()).toBeNull();
  });

  it('does not consume for mismatched block id', () => {
    const queue = new PendingFocusQueue();
    queue.queueFocus({ blockId: 'a', offset: 3 });
    expect(queue.consumePendingFocus('b')).toBeNull();
    expect(queue.consumePendingFocus('a')?.offset).toBe(3);
  });

  it('clear removes pending focus', () => {
    const queue = new PendingFocusQueue();
    queue.queueFocus({ blockId: 'x', offset: 'end' });
    queue.clear();
    expect(queue.consumePendingFocus('x')).toBeNull();
  });
});
