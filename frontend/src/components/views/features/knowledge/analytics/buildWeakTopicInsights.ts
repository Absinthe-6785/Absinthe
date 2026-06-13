import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { filterWeakTopicNotes, isWeakTopic } from '../study/weakTopicTracking';
import { hasTag, listTags } from '../tags/noteTags';
import { SUBJECT_DASHBOARDS } from '../maps/subjectDashboards';

export interface WeakTopicSubjectCount {
  subjectId: string;
  subjectName: string;
  count: number;
}

export interface WeakTopicInsightEntry {
  noteId: string;
  noteTitle: string;
  subjects: string[];
  meta: string;
}

export interface WeakTopicInsightsData {
  totalCount: number;
  unresolvedCount: number;
  bySubject: WeakTopicSubjectCount[];
  frequentAreas: WeakTopicInsightEntry[];
  unresolved: WeakTopicInsightEntry[];
}

export interface BuildWeakTopicInsightsOptions {
  limit?: number;
}

function subjectNamesForNote(note: NoteBase): string[] {
  const tags = new Set(listTags(note));
  return SUBJECT_DASHBOARDS
    .filter(s => tags.has(s.tag))
    .map(s => s.name);
}

function toEntry(note: NoteBase): WeakTopicInsightEntry {
  const subjects = subjectNamesForNote(note);
  return {
    noteId: note.id,
    noteTitle: displayNoteTitle(note.title),
    subjects,
    meta: subjects.length > 0 ? subjects.join(', ') : '주제 미분류',
  };
}

/** Weak-topic breakdown by subject — no recommendations. */
export function buildWeakTopicInsights(
  notes: readonly NoteBase[],
  opts: BuildWeakTopicInsightsOptions = {},
): WeakTopicInsightsData {
  const limit = opts.limit ?? 6;
  const weakNotes = filterWeakTopicNotes(notes)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const bySubject = SUBJECT_DASHBOARDS.map(subject => ({
    subjectId: subject.id,
    subjectName: subject.name,
    count: weakNotes.filter(n => hasTag(n, subject.tag)).length,
  })).filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);

  const unresolved = weakNotes
    .filter(isWeakTopic)
    .slice(0, limit)
    .map(toEntry);

  const frequentAreas = [...weakNotes]
    .slice(0, limit)
    .map(toEntry);

  return {
    totalCount: weakNotes.length,
    unresolvedCount: weakNotes.length,
    bySubject,
    frequentAreas,
    unresolved,
  };
}
