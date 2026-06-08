/** Position fixed menus within the viewport; flip above anchor when clipped at bottom. */

export function computeFixedMenuPosition(
  anchorX: number,
  anchorY: number,
  menuWidth: number,
  menuHeight: number,
  margin = 8,
): { top: number; left: number } {
  let top = anchorY;
  let left = anchorX;

  if (top + menuHeight > window.innerHeight - margin) {
    top = anchorY - menuHeight;
  }
  if (top < margin) {
    top = Math.max(margin, window.innerHeight - menuHeight - margin);
  }

  if (left + menuWidth > window.innerWidth - margin) {
    left = window.innerWidth - menuWidth - margin;
  }
  if (left < margin) left = margin;

  return { top, left };
}
