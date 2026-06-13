import type { Language } from '../../../../../lib/i18n';
import { getTranslator, resolveIntlLocale } from '../../../../../lib/i18n';
import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { collectCitationsFromMarkdown } from '../../../citationUtils';
import {
  filterNotesByKind,
  getNoteKind,
  getNoteKindPromotedAt,
  type NoteKind,
} from './noteClassification';
import { noteKindLabel } from '../knowledgeLabels';
import { READING_NOTE_TAG } from './readingNoteTemplate';

export interface ResearchNoteEntry {
  noteId: string;
  noteTitle: string;
  meta: string;
}

export interface SourcePipelineOverview {
  source: number;
  literature: number;
  permanent: number;
  unclassified: number;
}

export interface ResearchDashboardData {
  recentSources: ResearchNoteEntry[];
  readingNotes: ResearchNoteEntry[];
  literatureNotes: ResearchNoteEntry[];
  permanentNotes: ResearchNoteEntry[];
  citationActivity: ResearchNoteEntry[];
  promotionActivity: ResearchNoteEntry[];
  sourcePipeline: SourcePipelineOverview;
  citationCount: number;
}

export interface BuildResearchDashboardOptions {
  limit?: number;
  language?: Language;
}

function toEntry(note: NoteBase, meta: string): ResearchNoteEntry {
  return {
    noteId: note.id,
    noteTitle: displayNoteTitle(note.title),
    meta,
  };
}

function formatEditedMeta(note: NoteBase, lang: Language): string {
  const t = getTranslator(lang);
  const date = new Date(note.updatedAt).toLocaleDateString(resolveIntlLocale(lang), { month: 'short', day: 'numeric' });
  return t('wsEdited').replace('{time}', date);
}

function recentByKind(notes: readonly NoteBase[], kind: NoteKind, limit: number, lang: Language): ResearchNoteEntry[] {
  return filterNotesByKind(notes, kind)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(n => toEntry(n, formatEditedMeta(n, lang)));
}

function hasReadingTag(note: NoteBase): boolean {
  const tags = note.properties?.tags ?? '';
  return tags.toLowerCase().split(',').map(t => t.trim()).includes(READING_NOTE_TAG);
}

function buildSourcePipeline(notes: readonly NoteBase[]): SourcePipelineOverview {
  let source = 0;
  let literature = 0;
  let permanent = 0;
  let unclassified = 0;
  for (const note of notes) {
    const kind = getNoteKind(note);
    if (kind === 'source') source += 1;
    else if (kind === 'literature') literature += 1;
    else if (kind === 'permanent') permanent += 1;
    else unclassified += 1;
  }
  return { source, literature, permanent, unclassified };
}

export function buildResearchDashboard(
  notes: readonly NoteBase[],
  opts: BuildResearchDashboardOptions = {},
): ResearchDashboardData {
  const limit = opts.limit ?? 6;
  const lang = opts.language ?? 'ko';
  const t = getTranslator(lang);
  const active = notes.filter(n => !n.deletedAt);

  const readingNotes = active
    .filter(n => hasReadingTag(n) || (n.title ?? '').toLowerCase().includes('reading'))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(n => {
      const kind = getNoteKind(n);
      const meta = kind
        ? `${noteKindLabel(kind, lang)}`
        : t('researchReadingNotes');
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

  const citationCount = active.reduce(
    (sum, note) => sum + collectCitationsFromMarkdown(note.body ?? '').length,
    0,
  );

  const promotionActivity = active
    .map(note => ({ note, promotedAt: getNoteKindPromotedAt(note) }))
    .filter(row => row.promotedAt !== null)
    .sort((a, b) => (b.promotedAt ?? 0) - (a.promotedAt ?? 0))
    .slice(0, limit)
    .map(({ note, promotedAt }) => {
      const kind = getNoteKind(note);
      const kindLabel = kind ? noteKindLabel(kind, lang) : t('knNoClassification');
      const when = new Date(promotedAt!).toLocaleDateString(resolveIntlLocale(lang), { month: 'short', day: 'numeric' });
      return toEntry(note, `${kindLabel} · ${when}`);
    });

  return {
    recentSources: recentByKind(active, 'source', limit, lang),
    readingNotes,
    literatureNotes: recentByKind(active, 'literature', limit, lang),
    permanentNotes: recentByKind(active, 'permanent', limit, lang),
    citationActivity: citationNotes.map(({ note, count }) =>
      toEntry(note, t('researchCitationMeta').replace('{count}', String(count))),
    ),
    promotionActivity,
    sourcePipeline: buildSourcePipeline(active),
    citationCount,
  };
}
