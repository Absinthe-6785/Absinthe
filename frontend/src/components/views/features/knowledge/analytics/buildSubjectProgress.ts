import type { NoteBase } from '../../../noteUtils';
import { isConceptNote } from '../research/noteClassification';
import { isStudyNote } from '../study/studyNoteTemplate';
import { isWeakTopic } from '../study/weakTopicTracking';
import { hasTag } from '../tags/noteTags';
import { filterStudyProjectContainers } from '../academic/studyProjectModels';
import { SUBJECT_DASHBOARDS } from '../maps/subjectDashboards';

export interface SubjectProgressEntry {
  subjectId: string;
  subjectName: string;
  tag: string;
  noteCount: number;
  studyNoteCount: number;
  weakTopicCount: number;
  conceptCount: number;
  projectCount: number;
}

export interface SubjectProgressData {
  subjects: SubjectProgressEntry[];
}

export interface BuildSubjectProgressOptions {
  /** Include subjects with zero notes */
  includeEmpty?: boolean;
}

/** Informational subject-level metrics — no scores. */
export function buildSubjectProgress(
  notes: readonly NoteBase[],
  opts: BuildSubjectProgressOptions = {},
): SubjectProgressData {
  const active = notes.filter(n => !n.deletedAt);
  const subjects = SUBJECT_DASHBOARDS.map(subject => {
    const tagged = active.filter(n => hasTag(n, subject.tag));
    const projectCount = filterStudyProjectContainers(active).filter(
      p => hasTag(p, subject.tag),
    ).length;
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      tag: subject.tag,
      noteCount: tagged.length,
      studyNoteCount: tagged.filter(isStudyNote).length,
      weakTopicCount: tagged.filter(isWeakTopic).length,
      conceptCount: tagged.filter(isConceptNote).length,
      projectCount,
    };
  }).filter(s => opts.includeEmpty || s.noteCount > 0 || s.projectCount > 0);

  return { subjects };
}
