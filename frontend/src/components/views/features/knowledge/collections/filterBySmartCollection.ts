import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { evaluateSmartCollection } from './evaluateSmartCollection';
import type { SmartCollectionId } from './smartCollectionModels';

export interface FilterSmartCollectionResult {
  notes: NoteBase[];
  matchedIds: Set<string>;
}

/**
 * Filter a note list by smart collection membership.
 * Preserves collection ordering for ranked collections (recent, highly-connected).
 */
export function filterBySmartCollection(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  collectionId: SmartCollectionId,
  vaultNotes: readonly NoteBase[],
): FilterSmartCollectionResult {
  const orderedIds = evaluateSmartCollection(collectionId, service, vaultNotes);
  const matchedIds = new Set(orderedIds);
  const order = new Map(orderedIds.map((id, index) => [id, index]));

  const filtered = notes
    .filter(note => matchedIds.has(note.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { notes: filtered, matchedIds };
}
