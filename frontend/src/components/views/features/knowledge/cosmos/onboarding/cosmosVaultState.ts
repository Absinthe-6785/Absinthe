import type { NoteBase } from '../../../../noteUtils';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';

export type CosmosVaultPhase =
  | 'no-notes'
  | 'no-links'
  | 'linked-healthy'
  | 'has-discoveries';

export type CosmosEmptyScenario = 'no-notes' | 'no-links';

export function countActiveNotes(notes: readonly NoteBase[]): number {
  return notes.filter(n => !n.deletedAt).length;
}

export function countVaultLinks(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): number {
  if (countActiveNotes(notes) === 0) return 0;
  return service.getGlobalEdgeCount();
}

export function resolveCosmosVaultPhase(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  discoveryTotal: number,
): CosmosVaultPhase {
  const activeCount = countActiveNotes(notes);
  if (activeCount === 0) return 'no-notes';
  if (countVaultLinks(notes, service) === 0) return 'no-links';
  if (discoveryTotal > 0) return 'has-discoveries';
  return 'linked-healthy';
}

/** Cosmos graph overlay — no notes, or notes without links. */
export function resolveCosmosEmptyScenario(input: {
  activeNoteCount: number;
  linkCount: number;
  hasSearchFilter: boolean;
  searchHasMatches: boolean;
}): CosmosEmptyScenario | null {
  if (input.hasSearchFilter && !input.searchHasMatches) return null;
  if (input.activeNoteCount === 0) return 'no-notes';
  if (input.linkCount === 0) return 'no-links';
  return null;
}

export function formatFirstDiscoveryMessage(
  title: string,
  targetTitle?: string,
): string {
  if (targetTitle) return `${title} ↔ ${targetTitle}`;
  return title;
}
