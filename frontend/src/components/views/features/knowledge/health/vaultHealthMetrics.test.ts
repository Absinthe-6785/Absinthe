import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildVaultHealthMetrics } from './vaultHealthMetrics';

function note(id: string, title: string, extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body: '', updatedAt: Date.now(), ...extra };
}

describe('vaultHealthMetrics', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('computes lightweight vault health from existing indexes', () => {
    const notes = [
      note('a', 'Alpha'),
      note('b', 'Beta', { body: '[[Alpha]]' }),
      note('c', 'Gamma'),
    ];
    service.buildFromNotes(notes);
    const metrics = buildVaultHealthMetrics(notes, service);

    expect(metrics.totalNotes).toBe(3);
    expect(metrics.connectedNotes).toBeGreaterThanOrEqual(1);
    expect(metrics.isolatedNotes).toBe(1);
    expect(metrics.averageLinksPerNote).toBeGreaterThanOrEqual(0);
  });
});
