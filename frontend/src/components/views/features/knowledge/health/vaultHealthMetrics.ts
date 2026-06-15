import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { collectIsolatedNoteIds } from '../isolation/vaultIsolation';
import { noteLastOpenedAt, daysSince } from '../review/staleNotes';

export interface VaultHealthMetrics {
  totalNotes: number;
  connectedNotes: number;
  isolatedNotes: number;
  averageLinksPerNote: number;
  recentlyActiveNotes: number;
  totalRelations: number;
}

/** Lightweight vault health from existing indexes — O(N). */
export function buildVaultHealthMetrics(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  now = Date.now(),
): VaultHealthMetrics {
  const active = notes.filter(n => !n.deletedAt);
  let connectedNotes = 0;
  let linkSum = 0;
  let recentlyActiveNotes = 0;
  let totalRelations = 0;

  for (const note of active) {
    const score = service.getConnectionScore(note.id);
    const relOut = service.getOutgoingRelations(note.id).length;
    const relIn = service.getIncomingRelations(note.id).length;
    totalRelations += relOut;
    if (score > 0 || relIn > 0) connectedNotes += 1;
    linkSum += score;
    if (daysSince(noteLastOpenedAt(note), now) <= 7) recentlyActiveNotes += 1;
  }

  const isolatedNotes = collectIsolatedNoteIds(active, service, active.length).length;

  return {
    totalNotes: active.length,
    connectedNotes,
    isolatedNotes,
    averageLinksPerNote: active.length > 0
      ? Math.round((linkSum / active.length) * 10) / 10
      : 0,
    recentlyActiveNotes,
    totalRelations,
  };
}
