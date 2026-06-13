import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { isConceptNote } from '../research/noteClassification';
import {
  buildStudyProjectSummary,
  filterNotesLinkedToProject,
  getStudyProjectDescription,
  getStudyProjectStatus,
  type StudyProjectStatus,
} from './studyProjectModels';
import {
  buildProjectMilestoneEntry,
  filterProjectMilestones,
  isProjectMilestone,
} from './projectMilestoneModels';

export interface ProjectEditorEntry {
  noteId: string;
  noteTitle: string;
  meta: string;
}

export interface ProjectEditorData {
  projectId: string;
  title: string;
  description: string;
  status: StudyProjectStatus;
  linkedNotes: ProjectEditorEntry[];
  milestones: ProjectEditorEntry[];
  concepts: ProjectEditorEntry[];
  summary: ReturnType<typeof buildStudyProjectSummary>;
}

export interface BuildProjectEditorDataOptions {
  limit?: number;
}

function toEntry(note: NoteBase, meta: string): ProjectEditorEntry {
  return {
    noteId: note.id,
    noteTitle: displayNoteTitle(note.title),
    meta,
  };
}

/** Project editor view model — reuses existing property infrastructure. */
export function buildProjectEditorData(
  notes: readonly NoteBase[],
  project: NoteBase,
  opts: BuildProjectEditorDataOptions = {},
): ProjectEditorData {
  const limit = opts.limit ?? 8;
  const linked = filterNotesLinkedToProject(notes, project.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const milestones = filterProjectMilestones(notes, project.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const concepts = linked
    .filter(n => !isProjectMilestone(n) && isConceptNote(n))
    .slice(0, limit);
  const generalLinked = linked
    .filter(n => !isProjectMilestone(n) && !isConceptNote(n))
    .slice(0, limit);

  return {
    projectId: project.id,
    title: displayNoteTitle(project.title),
    description: getStudyProjectDescription(project),
    status: getStudyProjectStatus(project) ?? 'planned',
    linkedNotes: generalLinked.map(n =>
      toEntry(n, new Date(n.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })),
    ),
    milestones: milestones.slice(0, limit).map(n => {
      const entry = buildProjectMilestoneEntry(n, displayNoteTitle(project.title));
      return toEntry(n, entry.meta);
    }),
    concepts: concepts.map(n => toEntry(n, '개념')),
    summary: buildStudyProjectSummary(notes, project),
  };
}
