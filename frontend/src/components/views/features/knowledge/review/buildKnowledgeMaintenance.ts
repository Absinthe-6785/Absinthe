import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeMaintenanceData } from '../components/KnowledgeMaintenancePanel';
import { buildKnowledgeHealthMetrics } from './knowledgeHealth';
import { buildOrphanNotes } from './orphanNotes';
import { buildReviewQueue } from './reviewQueue';
import { buildStaleNotesBuckets } from './staleNotes';

export interface BuildKnowledgeMaintenanceOptions {
  staleLimitPerTier?: number;
  orphanLimit?: number;
  queueLimit?: number;
}

export function buildKnowledgeMaintenanceData(
  notes: readonly NoteBase[],
  opts: BuildKnowledgeMaintenanceOptions = {},
): KnowledgeMaintenanceData {
  return {
    health: buildKnowledgeHealthMetrics(notes),
    stale: buildStaleNotesBuckets(notes, { limitPerTier: opts.staleLimitPerTier ?? 6 }),
    orphans: buildOrphanNotes(notes, { limit: opts.orphanLimit ?? 8 }),
    queue: buildReviewQueue(notes, { limit: opts.queueLimit ?? 10 }),
  };
}
