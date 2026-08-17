import { describe, expect, it, vi } from 'vitest';
import { auditSyncPaths } from './k114SyncPathAudit';
import { auditIncrementalSync } from './k114IncrementalSyncAudit';
import { auditSyncLoop } from './k114SyncLoopAudit';
import { auditRequestGate } from './k114RequestGateAudit';
import { auditMemoryProfile } from './k114MemoryProfileAudit';
import { auditLargeVault, runK114LargeVaultMatrix } from './k114LargeVaultAudit';
import { auditLeakCandidates } from './k114LeakAudit';
import { auditAutosave } from './k114AutosaveAudit';
import { auditWatchdog } from './k114WatchdogAudit';
import {
  buildNotesFetchUrl,
  resolveNotesSyncMode,
  mergeDeltaNoteRows,
  resetNotesSyncClientForTest,
  writeLastNotesSyncAt,
} from '../lib/notesSyncClient';
import { resetSyncGateForTest, runCoalescedHydrate } from '../lib/syncRequestGate';

describe('k114 audits', () => {
  it('sync path uses client and bootstrap guard', () => {
    expect(auditSyncPaths().usesNotesSyncClient).toBe(true);
  });

  it('incremental sync wired end-to-end', () => {
    const items = auditIncrementalSync();
    expect(items).toContain('backend-filter');
    expect(items).toContain('client-updated-after');
  });

  it('sync loop guards present', () => {
    const guards = auditSyncLoop();
    expect(guards).toContain('hydrate-coalesce');
    expect(guards).toContain('bootstrap-once-wired');
    expect(guards).toContain('account-lifecycle-reset-wired');
    expect(guards).toContain('legacy-notes-hydrate-push-not-reactivated');
  });

  it('request gate hooks', () => {
    expect(auditRequestGate()).toContain('runCoalescedHydrate');
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

  it('notesSyncClient delta URL', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => { storage.set(k, v); },
      removeItem: (k: string) => { storage.delete(k); },
    });
    resetNotesSyncClientForTest();
    writeLastNotesSyncAt(1_700_000_000_000);
    expect(resolveNotesSyncMode()).toBe('delta');
    expect(buildNotesFetchUrl('delta', 1_700_000_000_000)).toContain('updated_after=');
  });

  it('mergeDeltaNoteRows keeps newer', () => {
    const merged = mergeDeltaNoteRows(
      [{ id: 'a', title: 'old', body: '', updatedAt: 1, folderId: null, deletedAt: null }],
      [{ id: 'a', title: 'new', body: '', updatedAt: 2, folderId: null, deletedAt: null }],
    );
    expect(merged[0]?.title).toBe('new');
  });

  it('runCoalescedHydrate collapses parallel calls', async () => {
    resetSyncGateForTest();
    let runs = 0;
    const fn = async () => { runs += 1; await new Promise(r => setTimeout(r, 10)); };
    await Promise.all([runCoalescedHydrate(fn), runCoalescedHydrate(fn)]);
    expect(runs).toBe(1);
  });
});
