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
  /** Reuse the editor's vault-versioned queue instead of ranking it twice. */
  reviewQueue?: KnowledgeMaintenanceData['queue'];
}

/** The editor badge uses the same ranked (and capped) queue as the dashboard. */
export function buildKnowledgeMaintenanceQueue(notes: readonly NoteBase[], limit?: number): KnowledgeMaintenanceData['queue'] {
  return buildReviewQueue(notes, { limit: limit ?? 10 });
}

export function buildKnowledgeMaintenanceData(
  notes: readonly NoteBase[],
  opts: BuildKnowledgeMaintenanceOptions = {},
): KnowledgeMaintenanceData {
  return {
    health: buildKnowledgeHealthMetrics(notes),
    stale: buildStaleNotesBuckets(notes, { limitPerTier: opts.staleLimitPerTier ?? 6 }),
    orphans: buildOrphanNotes(notes, { limit: opts.orphanLimit ?? 8 }),
    queue: opts.reviewQueue ?? buildKnowledgeMaintenanceQueue(notes, opts.queueLimit),
  };
}
