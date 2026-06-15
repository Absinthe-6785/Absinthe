import { useCallback, useRef } from 'react';

export interface UseSwipeNavigationOptions {
  enabled?: boolean;
  minDistance?: number;
  maxVerticalRatio?: number;
}

/**
 * Horizontal swipe navigation for mobile calendar surfaces.
 * Swipe left → next period; swipe right → previous period.
 */
export function useSwipeNavigation(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  options: UseSwipeNavigationOptions = {},
) {
  const { enabled = true, minDistance = 48, maxVerticalRatio = 1.5 } = options;
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    const touch = e.touches[0];
    if (!touch) return;
    startRef.current = { x: touch.clientX, y: touch.clientY };
  }, [enabled]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled || !startRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) {
      startRef.current = null;
      return;
    }
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;
    startRef.current = null;

    if (Math.abs(dx) < minDistance) return;
    if (Math.abs(dy) * maxVerticalRatio > Math.abs(dx)) return;

    if (dx < 0) onSwipeLeft();
    else onSwipeRight();
  }, [enabled, minDistance, maxVerticalRatio, onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchEnd };
}
