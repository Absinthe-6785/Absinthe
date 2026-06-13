import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterNotesByKind } from '../research/noteClassification';
import type { SmartCollectionId } from './smartCollectionModels';

/**
 * Compute note ids for a smart collection from indexes and note metadata.
 * Results are never persisted — always derived at read time.
 */
export function evaluateSmartCollection(
  collectionId: SmartCollectionId,
  service: KnowledgeIndexService,
  notes: readonly NoteBase[],
): string[] {
  switch (collectionId) {
    case 'recent':
      return [...notes]
        .filter(note => !note.deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(note => note.id);
    case 'orphan':
      return service.getOrphanNoteIds();
    case 'untagged':
      return service.getUntaggedNoteIds();
    case 'highly-connected':
      return service.getHighlyConnectedNoteIds();
    case 'with-backlinks':
      return service.getNoteIdsWithBacklinks();
    case 'with-mentions':
      return service.getNoteIdsWithMentions();
    case 'research-sources':
      return filterNotesByKind(notes, 'source')
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'research-literature':
      return filterNotesByKind(notes, 'literature')
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'research-permanent':
      return filterNotesByKind(notes, 'permanent')
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    default: {
      const _exhaustive: never = collectionId;
      return _exhaustive;
    }
  }
}
