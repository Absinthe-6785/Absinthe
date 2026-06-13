import { describe, it, expect } from 'vitest';
import {
  dashboardOuterPadding,
  isMobileWidth,
  isTabletWidth,
  responsiveMetricGridColumns,
  responsiveStatGridColumns,
} from './responsiveLayout';

describe('responsiveLayout', () => {
  it('classifies mobile and tablet widths', () => {
    expect(isMobileWidth(375)).toBe(true);
    expect(isMobileWidth(768)).toBe(false);
    expect(isTabletWidth(900)).toBe(true);
  });

  it('uses two-column grids on mobile', () => {
    expect(responsiveStatGridColumns(true, false, 4)).toBe('repeat(2, minmax(0, 1fr))');
    expect(responsiveMetricGridColumns(true)).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('reduces dashboard padding on mobile', () => {
    expect(dashboardOuterPadding(true)).toBe(8);
    expect(dashboardOuterPadding(false)).toBe(12);
  });
});
