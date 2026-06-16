import { describe, expect, it } from 'vitest';
import type { NoteBase } from '../noteUtils';
import { knowledgeIndexService } from '../features/knowledge';
import { filterNotesForSidebarList } from './sidebarNoteListFilter';

function note(id: string, title: string, body = ''): NoteBase {
  return {
    id,
    title,
    body,
    folderId: null,
    starred: false,
    updatedAt: Number(id.replace(/\D/g, '') || 0),
    createdAt: 0,
    properties: {},
    relations: [],
  } as NoteBase;
}

describe('filterNotesForSidebarList', () => {
  const notes = [
    note('n-100', 'Alpha Protocol', 'intro'),
    note('n-200', 'Beta Notes', 'alpha mention'),
    note('n-50', 'Gamma', 'unrelated'),
  ];

  it('returns all notes when query is empty', () => {
    expect(filterNotesForSidebarList(notes, '', knowledgeIndexService)).toHaveLength(3);
  });

  it('filters and ranks by plain-text score', () => {
    const filtered = filterNotesForSidebarList(notes, 'alpha', knowledgeIndexService);
    expect(filtered.map(n => n.id)).toEqual(['n-100', 'n-200']);
  });

  it('handles 3000 notes within budget', () => {
    const large: NoteBase[] = Array.from({ length: 3000 }, (_, i) =>
      note(`n-${i}`, `Note ${i}`, i % 17 === 0 ? 'quantum physics' : 'daily log'),
    );
    const t0 = performance.now();
    const filtered = filterNotesForSidebarList(large, 'quantum', knowledgeIndexService);
    const elapsed = performance.now() - t0;
    expect(filtered.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
  });
});
