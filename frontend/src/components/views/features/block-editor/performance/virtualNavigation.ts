import { getFocusHandler, type FocusCmd } from '../features/selection';
import { PendingFocusQueue } from './pendingFocusQueue';

export interface VirtualNavigationApi {
  /** Whether root virtualization navigation is active. */
  isVirtualNavigationEnabled: () => boolean;
  /** Scroll a root block into the virtual viewport. */
  scrollToBlockId: (blockId: string) => boolean;
  /**
   * Request focus at block/offset. Scrolls first when virtual; queues until mount.
   */
  requestFocus: (cmd: FocusCmd) => void;
  /** Called when a block mounts — returns and clears a queued focus for that id. */
  consumePendingFocus: (blockId: string) => FocusCmd | null;
}

export interface CreateVirtualNavigationApiOptions {
  virtualEnabled: boolean;
  scrollToBlockId: (blockId: string) => boolean;
  queue: PendingFocusQueue;
}

export function createVirtualNavigationApi({
  virtualEnabled,
  scrollToBlockId,
  queue,
}: CreateVirtualNavigationApiOptions): VirtualNavigationApi {
  const tryDispatch = (cmd: FocusCmd): boolean => {
    const handler = getFocusHandler(cmd.blockId);
    if (!handler) return false;
    handler(cmd);
    queue.consumePendingFocus(cmd.blockId);
    return true;
  };

  return {
    isVirtualNavigationEnabled: () => virtualEnabled,
    scrollToBlockId: (blockId) => {
      if (!virtualEnabled) return true;
      return scrollToBlockId(blockId);
    },
    requestFocus: (cmd) => {
      queue.queueFocus(cmd);
      if (virtualEnabled) {
        scrollToBlockId(cmd.blockId);
      }
      tryDispatch(cmd);
    },
    consumePendingFocus: (blockId) => {
      const cmd = queue.consumePendingFocus(blockId);
      if (!cmd) return null;
      return cmd;
    },
  };
}

/** No-op navigation used when virtualization is off at nested depth. */
export function createDirectFocusNavigation(
  queue: PendingFocusQueue,
): Pick<VirtualNavigationApi, 'requestFocus' | 'consumePendingFocus'> {
  return {
    requestFocus: (cmd) => {
      queue.queueFocus(cmd);
      const handler = getFocusHandler(cmd.blockId);
      if (handler) {
        handler(cmd);
        queue.consumePendingFocus(cmd.blockId);
      }
    },
    consumePendingFocus: (blockId) => queue.consumePendingFocus(blockId),
  };
}
