import type { FocusCmd } from '../features/selection';

/**
 * Queues focus commands until the target block mounts (virtualization-safe).
 */
export class PendingFocusQueue {
  private pending: FocusCmd | null = null;

  queueFocus(cmd: FocusCmd): void {
    this.pending = cmd;
  }

  consumePendingFocus(blockId: string): FocusCmd | null {
    if (!this.pending || this.pending.blockId !== blockId) return null;
    const cmd = this.pending;
    this.pending = null;
    return cmd;
  }

  peek(): FocusCmd | null {
    return this.pending;
  }

  clear(): void {
    this.pending = null;
  }
}
