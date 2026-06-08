/** Edge band (px) inside the note scroll container that triggers autoscroll. */
export const DRAG_AUTOSCROLL_EDGE_BAND_PX = 56;

const MIN_SPEED_PX = 4;
const MAX_SPEED_PX = 20;

/**
 * Scroll a container when the pointer is near its top or bottom edge.
 * Returns the scroll delta applied (0 if none).
 */
export function applyDragAutoscroll(
  container: HTMLElement,
  clientY: number,
  edgeBandPx = DRAG_AUTOSCROLL_EDGE_BAND_PX,
): number {
  const rect = container.getBoundingClientRect();
  const maxScroll = container.scrollHeight - container.clientHeight;
  if (maxScroll <= 0) return 0;

  if (clientY < rect.top + edgeBandPx) {
    const depth = Math.min(1, (rect.top + edgeBandPx - clientY) / edgeBandPx);
    const delta = -(MIN_SPEED_PX + depth * (MAX_SPEED_PX - MIN_SPEED_PX));
    const next = Math.max(0, container.scrollTop + delta);
    const applied = next - container.scrollTop;
    container.scrollTop = next;
    return applied;
  }

  if (clientY > rect.bottom - edgeBandPx) {
    const depth = Math.min(1, (clientY - (rect.bottom - edgeBandPx)) / edgeBandPx);
    const delta = MIN_SPEED_PX + depth * (MAX_SPEED_PX - MIN_SPEED_PX);
    const next = Math.min(maxScroll, container.scrollTop + delta);
    const applied = next - container.scrollTop;
    container.scrollTop = next;
    return applied;
  }

  return 0;
}
