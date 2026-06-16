/**
 * K-89C — Index build and incremental update performance regression guards.
 */
import { describe, expect, it } from 'vitest';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { measureMs } from '@/components/views/editorBenchmark';
import { KnowledgeIndexService } from './KnowledgeIndexService';
import { groupRelatedNotes } from './related/groupRelatedNotes';

describe('K-89C knowledge index performance', () => {
  it('cold build at 1000 notes stays under 1000ms', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 1000 });
    const service = new KnowledgeIndexService();
    const ms = measureMs(() => service.buildFromNotes(dataset.notes));
    expect(ms, `index build at 1000 notes took ${ms}ms`).toBeLessThan(1000);
  }, 30_000);

  it('cold build at 3000 notes stays under 5000ms', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 3000 });
    const service = new KnowledgeIndexService();
    const ms = measureMs(() => service.buildFromNotes(dataset.notes));
    expect(ms, `index build at 3000 notes took ${ms}ms`).toBeLessThan(5000);
  }, 60_000);

  it('single note edit is incremental — much faster than cold rebuild', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 500 });
    const service = new KnowledgeIndexService();
    service.buildFromNotes(dataset.notes);

    const coldMs = measureMs(() => service.buildFromNotes(dataset.notes));
    const target = dataset.notes[Math.floor(dataset.notes.length / 2)]!;
    const incrementalMs = measureMs(() => {
      service.updateNote({ ...target, body: `${target.body ?? ''}\nedit` });
    });

    expect(incrementalMs).toBeLessThan(coldMs);
    expect(incrementalMs, `incremental update took ${incrementalMs}ms vs cold ${coldMs}ms`).toBeLessThan(
      Math.max(50, coldMs / 5),
    );
  }, 30_000);

  it('related notes query stays fast after large cold build', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 1000 });
    const service = new KnowledgeIndexService();
    service.buildFromNotes(dataset.notes);

    const sampleId = dataset.notes[Math.floor(dataset.notes.length / 2)]!.id;
    const ms = measureMs(() => {
      groupRelatedNotes(sampleId, dataset.notes, service);
    });
    expect(ms, `related notes at 1000 notes took ${ms}ms`).toBeLessThan(50);
  }, 30_000);
});
