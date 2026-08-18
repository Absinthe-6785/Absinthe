import { describe, expect, it } from 'vitest';
import { auditSyncPathHooks, auditSyncPaths } from './k114SyncPathAudit';

describe('k114SyncPathAudit', () => {
  it('routes authenticated startup through the complete snapshot bootstrap', () => {
    const audit = auditSyncPaths();
    expect(audit.usesNotesSyncClient).toBe(true);
    expect(audit.appContentOnceGuard).toBe(true);
    expect(audit.healthSingleFlightWired).toBe(true);
    expect(audit.deltaSyncCallers).toEqual([]);
    expect(audit.dormantHydrateEntryPointsRemoved).toBe(true);
    expect(auditSyncPathHooks()).toContain('fetchCompleteNotesFoldersSnapshot');
    expect(auditSyncPathHooks()).toContain('startIndependentStartup');
    expect(auditSyncPathHooks()).not.toContain('notesBootstrapStarted');
  });

  it('has no unconditional GET /api/notes in store', () => {
    const audit = auditSyncPaths();
    expect(audit.duplicateFetchRisks).toEqual([]);
  });
});
