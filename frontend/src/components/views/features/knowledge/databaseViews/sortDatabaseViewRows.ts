import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getProperty } from '../properties/noteProperties';
import { listTags } from '../tags/noteTags';
import type { DatabaseViewSort } from './databaseViewModels';

export function getDatabaseRowSortValue(
  note: NoteBase,
  key: string,
  service: KnowledgeIndexService,
): string | number {
  switch (key) {
    case 'title':
      return (note.title ?? '').toLowerCase();
    case 'updatedAt':
      return note.updatedAt ?? 0;
    case 'tags':
      return listTags(note).join(', ').toLowerCase();
    default: {
      const fromNote = getProperty(note, key);
      if (fromNote !== undefined) return fromNote.toLowerCase();
      const props = service.getProperties(note.id);
      const match = Object.entries(props).find(
        ([propKey]) => propKey.toLowerCase() === key.toLowerCase(),
      );
      return (match?.[1] ?? '').toLowerCase();
    }
  }
}

export function sortDatabaseViewRows(
  notes: readonly NoteBase[],
  sort: DatabaseViewSort,
  service: KnowledgeIndexService,
): NoteBase[] {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...notes].sort((a, b) => {
    const aVal = getDatabaseRowSortValue(a, sort.key, service);
    const bVal = getDatabaseRowSortValue(b, sort.key, service);

    let cmp = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      cmp = aVal - bVal;
    } else {
      cmp = String(aVal).localeCompare(String(bVal));
    }

    if (cmp === 0) {
      cmp = (a.title ?? '').localeCompare(b.title ?? '');
    }
    return cmp * direction;
  });
}
