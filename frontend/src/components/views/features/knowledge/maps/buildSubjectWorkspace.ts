import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { hasTag } from '../tags/noteTags';
import { isStudyNote } from '../study/studyNoteTemplate';
import { isConceptNote } from '../research/noteClassification';
import { filterWeakTopicNotes } from '../study/weakTopicTracking';
import {
  buildSubjectDashboard,
  type SubjectDashboardData,
  type SubjectDashboardEntry,
} from './subjectDashboards';

export interface SubjectWorkspaceData extends SubjectDashboardData {
  weakTopics: SubjectDashboardEntry[];
  studyNotes: SubjectDashboardEntry[];
  activity: SubjectDashboardEntry[];
}

export interface BuildSubjectWorkspaceOptions {
  limit?: number;
}

function toEntry(note: NoteBase): SubjectDashboardEntry {
  return {
    noteId: note.id,
    noteTitle: displayNoteTitle(note.title),
    meta: new Date(note.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
  };
}

/** Per-subject workspace — reuses tag-based subject dashboard data. */
export function buildSubjectWorkspace(
  notes: readonly NoteBase[],
  subjectId: string,
  opts: BuildSubjectWorkspaceOptions = {},
): SubjectWorkspaceData | null {
  const base = buildSubjectDashboard(notes, subjectId, opts);
  if (!base) return null;
  const limit = opts.limit ?? 6;
  const tag = base.subject.tag;
  const tagged = notes.filter(n => !n.deletedAt && hasTag(n, tag));

  const weakTopics = filterWeakTopicNotes(tagged)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(toEntry);

  const studyNotes = tagged
    .filter(isStudyNote)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(toEntry);

  const activity = [...tagged]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(n => ({
      ...toEntry(n),
      meta: [
        isConceptNote(n) ? '개념' : null,
        isStudyNote(n) ? '학습' : null,
        toEntry(n).meta,
      ].filter(Boolean).join(' · '),
    }));

  return {
    ...base,
    weakTopics,
    studyNotes,
    activity,
  };
}

export function buildAllSubjectWorkspaces(
  notes: readonly NoteBase[],
  opts: BuildSubjectWorkspaceOptions = {},
): SubjectWorkspaceData[] {
  return [
    'japanese-history',
    'politics',
    'economics',
    'toefl',
    'vocabulary',
  ]
    .map(id => buildSubjectWorkspace(notes, id, opts))
    .filter((d): d is SubjectWorkspaceData => d !== null);
}
