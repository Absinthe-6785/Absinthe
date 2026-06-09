import type { Rect, Virtualizer } from '@tanstack/react-virtual';

const FALLBACK_VIEWPORT_HEIGHT = 600;
const FALLBACK_VIEWPORT_WIDTH = 800;

function parseCssPx(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Scroll rect observer with fallback dimensions for test environments (happy-dom)
 * where offsetHeight may be 0 despite explicit style height.
 */
export function observeScrollRectWithFallback<T extends Element>(
  instance: Virtualizer<T, Element>,
  cb: (rect: Rect) => void,
): void | (() => void) {
  const element = instance.scrollElement as HTMLElement | null;
  if (!element) return;

  const notify = () => {
    let height = element.offsetHeight;
    let width = element.offsetWidth;
    if (height <= 0) {
      height = parseCssPx(element.style.height)
        || parseCssPx(getComputedStyle(element).height)
        || FALLBACK_VIEWPORT_HEIGHT;
    }
    if (width <= 0) {
      width = parseCssPx(element.style.width)
        || parseCssPx(getComputedStyle(element).width)
        || FALLBACK_VIEWPORT_WIDTH;
    }
    cb({ width: Math.round(width), height: Math.round(height) });
  };

  notify();

  if (typeof ResizeObserver === 'undefined') return;

  const observer = new ResizeObserver(notify);
  observer.observe(element);
  return () => observer.disconnect();
}
