import { describe, expect, it, vi } from 'vitest';
import { registerFocusHandler } from '../features/selection';
import { PendingFocusQueue } from './pendingFocusQueue';
import { createVirtualNavigationApi } from './virtualNavigation';

describe('virtualNavigation', () => {
  it('requestFocus scrolls when virtual and dispatches when handler exists', () => {
    const queue = new PendingFocusQueue();
    const scrollToBlockId = vi.fn(() => true);
    const handler = vi.fn();
    const unregister = registerFocusHandler('block-1', handler);

    const api = createVirtualNavigationApi({
      virtualEnabled: true,
      scrollToBlockId,
      queue,
    });

    api.requestFocus({ blockId: 'block-1', offset: 5 });
    expect(scrollToBlockId).toHaveBeenCalledWith('block-1');
    expect(handler).toHaveBeenCalledWith({ blockId: 'block-1', offset: 5 });
    expect(queue.peek()).toBeNull();

    unregister();
  });

  it('requestFocus queues when handler not yet mounted', () => {
    const queue = new PendingFocusQueue();
    const api = createVirtualNavigationApi({
      virtualEnabled: true,
      scrollToBlockId: () => true,
      queue,
    });

    api.requestFocus({ blockId: 'off-screen', offset: 'start' });
    expect(queue.peek()).toEqual({ blockId: 'off-screen', offset: 'start' });

    const handler = vi.fn();
    const unregister = registerFocusHandler('off-screen', handler);
    const pending = api.consumePendingFocus('off-screen');
    expect(pending).toEqual({ blockId: 'off-screen', offset: 'start' });

    unregister();
  });

  it('does not scroll when virtual disabled', () => {
    const scrollToBlockId = vi.fn(() => true);
    const api = createVirtualNavigationApi({
      virtualEnabled: false,
      scrollToBlockId,
      queue: new PendingFocusQueue(),
    });
    api.scrollToBlockId('any');
    expect(scrollToBlockId).not.toHaveBeenCalled();
  });
});
