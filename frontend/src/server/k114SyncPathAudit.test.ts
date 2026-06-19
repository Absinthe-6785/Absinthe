import { describe, expect, it } from 'vitest';
import { auditSyncPathHooks, auditSyncPaths } from './k114SyncPathAudit';

describe('k114SyncPathAudit', () => {
  it('routes hydrate through notesSyncClient and gate', () => {
    const audit = auditSyncPaths();
    expect(audit.usesNotesSyncClient).toBe(true);
    expect(audit.appContentOnceGuard).toBe(true);
    expect(audit.deltaSyncCallers.length).toBeGreaterThan(0);
    expect(auditSyncPathHooks()).toContain('runCoalescedHydrate');
  });

  it('has no unconditional GET /api/notes in store', () => {
    const audit = auditSyncPaths();
    expect(audit.duplicateFetchRisks).toEqual([]);
  });
});
