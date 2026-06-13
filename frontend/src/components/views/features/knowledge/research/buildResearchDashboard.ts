import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { collectCitationsFromMarkdown } from '../../../citationUtils';
import { filterNotesByKind, getNoteKind, NOTE_KIND_LABELS_KO, type NoteKind } from './noteClassification';
import { READING_NOTE_TAG } from './readingNoteTemplate';

export interface ResearchNoteEntry {
  noteId: string;
  noteTitle: string;
  meta: string;
}

export interface ResearchDashboardData {
  recentSources: ResearchNoteEntry[];
  readingNotes: ResearchNoteEntry[];
  literatureNotes: ResearchNoteEntry[];
  permanentNotes: ResearchNoteEntry[];
  citationActivity: ResearchNoteEntry[];
  citationCount: number;
}

export interface BuildResearchDashboardOptions {
  limit?: number;
}

function toEntry(note: NoteBase, meta: string): ResearchNoteEntry {
  return {
    noteId: note.id,
    noteTitle: displayNoteTitle(note.title),
    meta,
  };
}

function recentByKind(notes: readonly NoteBase[], kind: NoteKind, limit: number): ResearchNoteEntry[] {
  return filterNotesByKind(notes, kind)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(n => toEntry(n, `수정 ${new Date(n.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`));
}

function hasReadingTag(note: NoteBase): boolean {
  const tags = note.properties?.tags ?? '';
  return tags.toLowerCase().split(',').map(t => t.trim()).includes(READING_NOTE_TAG);
}

export function buildResearchDashboard(
  notes: readonly NoteBase[],
  opts: BuildResearchDashboardOptions = {},
): ResearchDashboardData {
  const limit = opts.limit ?? 6;
  const active = notes.filter(n => !n.deletedAt);

  const readingNotes = active
    .filter(n => hasReadingTag(n) || (n.title ?? '').toLowerCase().includes('reading'))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(n => {
      const kind = getNoteKind(n);
      const meta = kind ? `분류: ${NOTE_KIND_LABELS_KO[kind]}` : '읽기 노트';
      return toEntry(n, meta);
    });

  const citationNotes = active
    .map(note => ({
      note,
      count: collectCitationsFromMarkdown(note.body ?? '').length,
    }))
    .filter(row => row.count > 0)
    .sort((a, b) => b.count - a.count || b.note.updatedAt - a.note.updatedAt)
    .slice(0, limit);

  const citationCount = citationNotes.reduce((sum, row) => sum + row.count, 0);

  return {
    recentSources: recentByKind(active, 'source', limit),
    readingNotes,
    literatureNotes: recentByKind(active, 'literature', limit),
    permanentNotes: recentByKind(active, 'permanent', limit),
    citationActivity: citationNotes.map(({ note, count }) =>
      toEntry(note, `인용 ${count}건`),
    ),
    citationCount,
  };
}
