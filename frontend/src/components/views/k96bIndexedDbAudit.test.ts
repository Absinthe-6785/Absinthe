// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  K96B_NOTE_COUNTS,
  formatK96BStorageAuditReport,
  measureLocalStorageBytes,
  runK96BStorageAuditRow,
  runK96BStorageMatrix,
  seedLegacyLocalStorageNotes,
} from './k96bIndexedDbAudit';
import { NOTES_KEY } from '@/components/views/noteUtils';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { resetNotesPersistenceForTests } from '@/lib/notePersistence';
import { clearIndexedDbNotes } from '@/lib/noteIndexedDb';

describe('k96bIndexedDbAudit', () => {
  beforeEach(async () => {
    resetNotesPersistenceForTests();
    localStorage.clear();
    await clearIndexedDbNotes();
  });

  it.each([100, 300] as const)('migrates %i notes off localStorage', async noteCount => {
    const row = await runK96BStorageAuditRow(noteCount);
    expect(row.localStorageBeforeBytes).toBeGreaterThan(10_000);
    expect(row.localStorageAfterBytes).toBeLessThan(100);
    expect(row.indexedDbRecordCount).toBe(noteCount);
    expect(row.startupMs).toBeGreaterThanOrEqual(0);
  });

  it('prints storage matrix', async () => {
    const subset = [];
    for (const noteCount of [100, 300, 1000] as const) {
      subset.push(await runK96BStorageAuditRow(noteCount));
    }
    const report = formatK96BStorageAuditReport(subset);
    console.log('\n' + report);
    expect(report).toContain('K-96B IndexedDB storage audit');
  });

  it('seedLegacyLocalStorageNotes writes notes-v2 payload', () => {
    const { notes } = buildLargeVaultDataset({ noteCount: 10 });
    const bytes = seedLegacyLocalStorageNotes(notes);
    expect(bytes).toBeGreaterThan(0);
    expect(measureLocalStorageBytes(NOTES_KEY)).toBe(bytes);
  });
});

describe('k96bIndexedDbAudit matrix shape', () => {
  it('defines expected note counts', () => {
    expect(K96B_NOTE_COUNTS).toEqual([100, 300, 1000, 3000]);
  });
});
