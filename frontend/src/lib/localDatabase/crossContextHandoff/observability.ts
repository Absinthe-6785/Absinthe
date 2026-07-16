import type { HandoffEffect, HandoffObserver } from './types';

export function observe(observer: HandoffObserver | undefined, effect: HandoffEffect): void {
  try {
    observer?.onEffect?.(effect);
  } catch {
    // Diagnostics never control storage behavior.
  }
}
