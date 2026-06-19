import { describe, expect, it } from 'vitest';
import { auditSurfaceInventory } from './k112SurfaceInventoryAudit';

describe('k112SurfaceInventoryAudit module', () => {
  it('exports surface hooks for all domains', () => {
    const { surfaces, hooks } = auditSurfaceInventory();
    expect(surfaces.length).toBe(8);
    expect(hooks.some(h => h.includes('k111'))).toBe(true);
    expect(hooks.some(h => h.includes('k110'))).toBe(true);
  });
});
