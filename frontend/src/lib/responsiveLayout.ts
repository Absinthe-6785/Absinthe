/** Shared viewport breakpoints for Notes / workspace surfaces. */
export const VIEWPORT_BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  narrow: 1280,
} as const;

export const TOUCH_TARGET_MIN_PX = 44;

export function isMobileWidth(width: number): boolean {
  return width < VIEWPORT_BREAKPOINTS.mobile;
}

export function isTabletWidth(width: number): boolean {
  return width >= VIEWPORT_BREAKPOINTS.mobile && width < VIEWPORT_BREAKPOINTS.tablet;
}

export function isNarrowWidth(width: number): boolean {
  return width < VIEWPORT_BREAKPOINTS.narrow;
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

export function dashboardOuterPadding(isMobile: boolean): number {
  return isMobile ? 8 : 12;
}

export function touchMinSize(isMobile: boolean): number | undefined {
  return isMobile ? TOUCH_TARGET_MIN_PX : undefined;
}
