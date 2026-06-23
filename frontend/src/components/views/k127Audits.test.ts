import { describe, expect, it } from 'vitest';
import {
  auditK127CardSurface,
  auditK127HeadersAndNav,
  auditK127Rc,
  auditK127TokenDedup,
} from './k127DesignSystemAudit';

describe('k127 design system pass audits', () => {
  it('normalizes card surfaces across workspaces', () => {
    const r = auditK127CardSurface();
    const failed = Object.entries(r).filter(([, v]) => !v).map(([k]) => k);
    expect(failed, failed.join(', ')).toEqual([]);
  });

  it('unifies headers, nav, and empty states', () => {
    expect(Object.values(auditK127HeadersAndNav()).every(Boolean)).toBe(true);
  });

  it('deduplicates spacing and density tokens', () => {
    expect(Object.values(auditK127TokenDedup()).every(Boolean)).toBe(true);
  });

  it('full K-127 RC', () => {
    expect(auditK127Rc()).toBe(true);
  });
});
