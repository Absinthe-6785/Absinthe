/**
 * Canonical semantic viewport boundaries.
 *
 * These values intentionally match Tailwind's md/lg/xl minimum widths. A
 * boundary value belongs to the category that starts at that value: 768 is
 * tablet, 1024 is desktop, and 1280 is wide. Custom CSS and viewport hooks
 * must derive semantic media queries from this module instead of repeating
 * the numbers.
 */
export const VIEWPORT_BOUNDARIES = {
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

export const VIEWPORT_MEDIA_QUERIES = {
  mobile: `(max-width: ${VIEWPORT_BOUNDARIES.tablet - 1}px)`,
  tabletUp: `(min-width: ${VIEWPORT_BOUNDARIES.tablet}px)`,
  compact: `(max-width: ${VIEWPORT_BOUNDARIES.desktop - 1}px)`,
  desktopUp: `(min-width: ${VIEWPORT_BOUNDARIES.desktop}px)`,
  narrow: `(max-width: ${VIEWPORT_BOUNDARIES.wide - 1}px)`,
  wideUp: `(min-width: ${VIEWPORT_BOUNDARIES.wide}px)`,
} as const;

export type ViewportCategory = 'mobile' | 'tablet' | 'desktop' | 'wide';

export const TOUCH_TARGET_MIN_PX = 44;

export function isMobileWidth(width: number): boolean {
  return width < VIEWPORT_BOUNDARIES.tablet;
}

export function isTabletWidth(width: number): boolean {
  return width >= VIEWPORT_BOUNDARIES.tablet && width < VIEWPORT_BOUNDARIES.desktop;
}

export function isNarrowWidth(width: number): boolean {
  return width < VIEWPORT_BOUNDARIES.wide;
}

export function isDesktopWidth(width: number): boolean {
  return width >= VIEWPORT_BOUNDARIES.desktop && width < VIEWPORT_BOUNDARIES.wide;
}

export function isWideWidth(width: number): boolean {
  return width >= VIEWPORT_BOUNDARIES.wide;
}

export function classifyViewportWidth(width: number): ViewportCategory {
  if (isMobileWidth(width)) return 'mobile';
  if (isTabletWidth(width)) return 'tablet';
  if (isDesktopWidth(width)) return 'desktop';
  return 'wide';
}

/** Responsive stat grid — 2 columns on phone, 4 on desktop. */
export function responsiveStatGridColumns(isMobile: boolean, isTablet: boolean, desktopCols = 4): string {
  if (isMobile) return 'repeat(2, minmax(0, 1fr))';
  if (isTablet && desktopCols >= 4) return 'repeat(2, minmax(0, 1fr))';
  return `repeat(${desktopCols}, minmax(0, 1fr))`;
}

/** Pipeline / metric grids — avoid 4-up on narrow screens. */
export function responsiveMetricGridColumns(isMobile: boolean): string {
  return isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))';
}

export function dashboardOuterPadding(isMobile: boolean, isTablet = false): number {
  if (isMobile) return 8;
  if (isTablet) return 10;
  return 12;
}

export function touchMinSize(isMobile: boolean, isTablet = false): number | undefined {
  return isMobile || isTablet ? TOUCH_TARGET_MIN_PX : undefined;
}
