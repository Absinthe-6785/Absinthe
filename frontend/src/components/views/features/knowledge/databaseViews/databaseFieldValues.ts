import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getProperty } from '../properties/noteProperties';
import { listTags } from '../tags/noteTags';
import { parseDatabaseDate } from './parseDatabaseDate';

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

/** Resolve a note's calendar date from built-in metadata or property values */
export function getNoteDateValue(
  note: NoteBase,
  dateProperty: string,
  service: KnowledgeIndexService,
): Date | null {
  const key = dateProperty.trim();
  if (!key) return null;

  if (key === 'updatedAt') {
    return note.updatedAt ? new Date(note.updatedAt) : null;
  }

  if (key === 'createdAt') {
    const extended = note as NoteBase & { createdAt?: number };
    if (typeof extended.createdAt === 'number' && extended.createdAt > 0) {
      return new Date(extended.createdAt);
    }
  }

  const raw = key === 'createdAt'
    ? getDatabaseFieldValue(note, 'createdAt', service)
    : getDatabaseFieldValue(note, key, service);
  if (!raw) return null;

  if (key === 'updatedAt' || key === 'createdAt') {
    if (/^\d+$/.test(raw)) {
      const timestamp = Number(raw);
      if (timestamp > 0) return new Date(timestamp);
    }
  }

  return parseDatabaseDate(raw);
}
