import { describe, expect, it } from 'vitest';
import {
  auditK125eRecoveryRc,
  K125E_RECOVERY_SECTIONS,
} from './k125eRecoveryAudit';
import { auditMemoryRc } from './k120MemoryAudit';
import { auditEmptyStateRc as auditK119EmptyStateRc } from './k119EmptyStateAudit';
import { auditEmptyStateRc as auditK121EmptyStateRc } from './k121EmptyStateAudit';

describe('k125e backup recovery audits', () => {
  it('K-125E — backup/recovery UX, snapshot cards, restore confirmation', () => {
    expect(auditK125eRecoveryRc()).toBe(true);
    expect(K125E_RECOVERY_SECTIONS).toEqual(['backup', 'recovery', 'export']);
  });

  it('K-120 — memory observation (regression)', () => {
    expect(auditMemoryRc()).toBe(true);
  });

  it('K-119 — empty state density (regression)', () => {
    expect(auditK119EmptyStateRc()).toBe(true);
  });

  it('K-121 — empty state density (regression)', () => {
    expect(auditK121EmptyStateRc()).toBe(true);
  });
});
