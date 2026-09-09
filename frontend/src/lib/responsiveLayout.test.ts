import { describe, it, expect } from 'vitest';
import {
  classifyViewportWidth,
  dashboardOuterPadding,
  isDesktopWidth,
  isMobileWidth,
  isNarrowWidth,
  isTabletWidth,
  isWideWidth,
  responsiveMetricGridColumns,
  responsiveStatGridColumns,
  touchMinSize,
  VIEWPORT_BOUNDARIES,
  VIEWPORT_MEDIA_QUERIES,
} from './responsiveLayout';

describe('responsiveLayout', () => {
  it.each([
    [767, 'mobile'],
    [768, 'tablet'],
    [769, 'tablet'],
    [1023, 'tablet'],
    [1024, 'desktop'],
    [1025, 'desktop'],
    [1279, 'desktop'],
    [1280, 'wide'],
    [1281, 'wide'],
  ] as const)('classifies %ipx as %s', (width, category) => {
    expect(classifyViewportWidth(width)).toBe(category);
  });

  it('derives all semantic helpers from the canonical boundaries', () => {
    expect(VIEWPORT_BOUNDARIES).toEqual({ tablet: 768, desktop: 1024, wide: 1280 });
    expect(isMobileWidth(767)).toBe(true);
    expect(isMobileWidth(768)).toBe(false);
    expect(isTabletWidth(768)).toBe(true);
    expect(isTabletWidth(1024)).toBe(false);
    expect(isDesktopWidth(1024)).toBe(true);
    expect(isDesktopWidth(1280)).toBe(false);
    expect(isNarrowWidth(1279)).toBe(true);
    expect(isWideWidth(1280)).toBe(true);
  });

  it('publishes media queries aligned with the Tailwind md/lg/xl boundaries', () => {
    expect(VIEWPORT_MEDIA_QUERIES).toEqual({
      mobile: '(max-width: 767px)',
      tabletUp: '(min-width: 768px)',
      compact: '(max-width: 1023px)',
      desktopUp: '(min-width: 1024px)',
      narrow: '(max-width: 1279px)',
      wideUp: '(min-width: 1280px)',
    });
  });

  it('uses two-column grids on mobile', () => {
    expect(responsiveStatGridColumns(true, false, 4)).toBe('repeat(2, minmax(0, 1fr))');
    expect(responsiveMetricGridColumns(true)).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('reduces dashboard padding on mobile and tablet', () => {
    expect(dashboardOuterPadding(true)).toBe(8);
    expect(dashboardOuterPadding(false, true)).toBe(10);
    expect(dashboardOuterPadding(false)).toBe(12);
  });

  it('applies touch targets on mobile and tablet', () => {
    expect(touchMinSize(true)).toBe(44);
    expect(touchMinSize(false, true)).toBe(44);
    expect(touchMinSize(false)).toBeUndefined();
  });
});
