import { describe, expect, it } from 'vitest';
import { auditSyncPaths } from './k114SyncPathAudit';
import { auditSyncLoop, auditSyncLoopSources } from './k114SyncLoopAudit';
import { auditMemoryProfile } from './k114MemoryProfileAudit';
import { auditLargeVault, runK114LargeVaultMatrix } from './k114LargeVaultAudit';
import { auditLeakCandidates } from './k114LeakAudit';
import { auditAutosave } from './k114AutosaveAudit';
import { auditWatchdog } from './k114WatchdogAudit';

describe('k114 audits', () => {
  it('sync path uses client and bootstrap guard', () => {
    expect(auditSyncPaths().usesNotesSyncClient).toBe(true);
    expect(auditSyncPaths().dormantHydrateEntryPointsRemoved).toBe(true);
  });

  it('sync loop guards present', () => {
    const guards = auditSyncLoop();
    expect(guards).toContain('bootstrap-once-wired');
    expect(guards).toContain('account-lifecycle-reset-wired');
    expect(guards).toContain('legacy-hydrate-entry-points-retired');
  });

  it('sync loop audit fails closed when a source guard is absent', () => {
    const app = `
      startIndependentStartup({
        startNotes: async () => {
          await initNotesStorage(authUser.id);
          await bootstrapFromSupabase();
        },
      });
      return () => { run.cancel(); detachNotesStorage(); };
    `;
    expect(auditSyncLoopSources(app, 'applyingStorageMerge')).toContain('storage-merge-guard');
    expect(auditSyncLoopSources(app.replace('startIndependentStartup', 'legacyStartup'), ''))
      .not.toContain('AppContent independent startup coordinator');
    expect(auditSyncLoopSources(app, '')).not.toContain('storage-merge-guard');
  });

  it('backend memory profile', () => {
    expect(auditMemoryProfile()).toContain('middleware-wired');
  });

  it('large vault matrix includes 10k', () => {
    expect(auditLargeVault()).toContain('10000');
    const rows = runK114LargeVaultMatrix();
    expect(rows[rows.length - 1]?.noteCount).toBe(10000);
  });

  it('leak candidates tracked', () => {
    expect(auditLeakCandidates().every(s => s.endsWith(':tracked'))).toBe(true);
  });

  it('autosave debounce guards', () => {
    expect(auditAutosave()).toContain('debounce-ms');
  });

  it('watchdog fields', () => {
    expect(auditWatchdog()).toContain('duration_ms');
  });

});
