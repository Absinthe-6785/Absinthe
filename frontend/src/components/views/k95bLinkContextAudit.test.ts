import { describe, expect, it } from 'vitest';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import {
  K95B_NOTE_COUNTS,
  measureLegacyLinkContextScan,
  measureOffsetLinkContextScan,
  outputsMatchLegacy,
  readK95bPolicySnapshot,
  runK95bBenchmarkRow,
} from './k95bLinkContextAudit';

function buildFixture(noteCount: number) {
  const dataset = buildLargeVaultDataset({ noteCount });
  const linked = dataset.notes.find(n => (n.body ?? '').includes('[['));
  const targetTitle = linked?.title ?? dataset.notes[0]!.title!;
  return { notes: dataset.notes, targetTitle };
}

describe('k95bLinkContextAudit policy', () => {
  it('reads offset index hooks from production sources', () => {
    const policy = readK95bPolicySnapshot();
    expect(policy.offsetModulePresent).toBe(true);
    expect(policy.noteViewPassesContentVersion).toBe(true);
    expect(policy.noteUtilsDelegatesToOffsetIndex).toBe(true);
  });
});

describe('k95bLinkContextAudit equivalence', () => {
  it.each(K95B_NOTE_COUNTS)('offset output matches legacy at %i notes', noteCount => {
    const { notes, targetTitle } = buildFixture(noteCount);
    expect(outputsMatchLegacy(notes, targetTitle)).toBe(true);
  });
});

describe('k95bLinkContextAudit scan attribution', () => {
  it.each(K95B_NOTE_COUNTS)('eliminates paragraph split allocations at %i notes', noteCount => {
    const row = runK95bBenchmarkRow(noteCount);
    expect(row.legacy.paragraphSplits).toBe(row.legacy.matchingNotes);
    expect(row.offset.paragraphSplits).toBe(0);
    expect(row.offset.offsetLookups).toBe(row.legacy.matchingNotes);
    expect(row.legacy.excerptCount).toBe(row.offset.excerptCount);
  });

  it.each(K95B_NOTE_COUNTS)('scans all note bodies for reference checks at %i notes', noteCount => {
    const { notes, targetTitle } = buildFixture(noteCount);
    const legacy = measureLegacyLinkContextScan(targetTitle, notes);
    const offset = measureOffsetLinkContextScan(targetTitle, notes, 2);
    expect(legacy.notesScanned).toBe(noteCount);
    expect(offset.notesScanned).toBe(noteCount);
    expect(legacy.referenceCheckBytes).toBe(offset.referenceCheckBytes);
  });
});

describe('k95bLinkContextAudit benchmark row', () => {
  it('prints tables when K95B_PRINT=1', () => {
    if (process.env.K95B_PRINT !== '1') return;
    for (const noteCount of K95B_NOTE_COUNTS) {
      const row = runK95bBenchmarkRow(noteCount);
      // eslint-disable-next-line no-console
      console.log('K95B_METRICS', JSON.stringify(row));
    }
  });

  it('reduces paragraph materialization on matching notes', () => {
    const row = runK95bBenchmarkRow(300);
    expect(row.paragraphByteReductionPct).toBeGreaterThan(0);
  });
});

describe('k95bLinkContextAudit integration', () => {
  it('does not require KnowledgeIndexService changes', () => {
    const service = new KnowledgeIndexService();
    const dataset = buildLargeVaultDataset({ noteCount: 50 });
    service.buildFromNotes(dataset.notes);
    expect(service.getAllNoteIds().length).toBe(50);
  });
});
