import type { CSSProperties } from 'react';

/** K-99 — consistent scroll panes with overflow containment. */
export const K99_SCROLL_PANE_CLASS = 'bscroll-pane';

export function scrollPaneStyle(extra?: CSSProperties): CSSProperties {
  return {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    ...extra,
  };
}

export const K99_STICKY_HEADER_CLASS = 'bsticky-header';

export function stickyHeaderStyle(background: string): CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    flexShrink: 0,
    background,
  };
}
