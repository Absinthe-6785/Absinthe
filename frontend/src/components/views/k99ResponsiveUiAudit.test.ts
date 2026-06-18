import { describe, expect, it } from 'vitest';
import {
  auditButtonPresets,
  auditResponsiveMatrix,
  formatK99ResponsiveUiReport,
  K99_BUTTON_SIZES,
  K99_RESPONSIVE_WIDTHS,
} from './k99ResponsiveUiAudit';
import { TOUCH_TARGET_MIN_PX } from '@/lib/responsiveLayout';

describe('k99ResponsiveUiAudit', () => {
  it.each(K99_BUTTON_SIZES)('preset %s meets mobile touch minimum', preset => {
    const row = auditButtonPresets().find(r => r.preset === preset);
    expect(row?.meetsTouchMin).toBe(true);
    expect(row?.mobilePx).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN_PX);
  });

  it.each(K99_RESPONSIVE_WIDTHS)('audits toolbar at %ipx', width => {
    const row = auditResponsiveMatrix().find(r => r.viewportPx === width);
    expect(row).toBeDefined();
    if (width < 768) {
      expect(row?.hasMoreMenu).toBe(true);
      expect(row?.minTapPx).toBe(TOUCH_TARGET_MIN_PX);
    }
  });

  it('prints responsive UI report', () => {
    const report = formatK99ResponsiveUiReport(auditButtonPresets(), auditResponsiveMatrix());
    console.log('\n' + report);
    expect(report).toContain('K-99 responsive UI audit');
    expect(report).toContain('320px');
  });
});
