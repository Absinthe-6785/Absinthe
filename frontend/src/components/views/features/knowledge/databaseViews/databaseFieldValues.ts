import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getProperty } from '../properties/noteProperties';
import { listTags } from '../tags/noteTags';

function formatUpdatedAt(timestamp: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Read a database field value for table cells and board cards */
export function getDatabaseFieldValue(
  note: NoteBase,
  key: string,
  service: KnowledgeIndexService,
): string {
  switch (key) {
    case 'title':
      return note.title || 'Untitled';
    case 'updatedAt':
      return formatUpdatedAt(note.updatedAt);
    case 'tags':
      return listTags(note).join(', ');
    default: {
      const fromNote = getProperty(note, key);
      if (fromNote !== undefined && fromNote.trim()) return fromNote.trim();
      const props = service.getProperties(note.id);
      const match = Object.entries(props).find(
        ([propKey]) => propKey.toLowerCase() === key.toLowerCase(),
      );
      return match?.[1]?.trim() ?? '';
    }
  }
}

/** Property value used for board lane assignment — empty when unset */
export function getNoteGroupValue(
  note: NoteBase,
  groupBy: string,
  service: KnowledgeIndexService,
): string {
  return getDatabaseFieldValue(note, groupBy, service);
}
