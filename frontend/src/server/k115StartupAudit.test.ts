import { describe, expect, it } from 'vitest';
import { auditStartupGuards, runK115StartupMatrix } from './k115StartupAudit';

describe('k115StartupAudit', () => {
  it('startup guards prevent duplicate account bootstrap', () => {
    const guards = auditStartupGuards();
    expect(guards.bootstrapOnce).toBe(true);
    expect(guards.completeSnapshotBootstrap).toBe(true);
    expect(guards.retiredHydratePaths).toBe(true);
  });

  it('startup matrix scales with vault size', () => {
    const rows = runK115StartupMatrix();
    expect(rows.length).toBe(4);
    expect(rows[rows.length - 1]!.noteCount).toBe(5000);
  });
});
