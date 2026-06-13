import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { getProperty, removeProperty, setProperty } from '../properties/noteProperties';
import { isConceptNote } from '../research/noteClassification';
import { isStudyNote } from '../study/studyNoteTemplate';

/** Study project container — property-based, no DB redesign. */
export const STUDY_PROJECT_MARKER = 'studyProject';
export const STUDY_PROJECT_STATUS_PROPERTY = 'studyProjectStatus';
export const STUDY_PROJECT_DESCRIPTION_PROPERTY = 'studyProjectDescription';
export const STUDY_PROJECT_LINK_PROPERTY = 'studyProjectId';

export type StudyProjectStatus = 'planned' | 'active' | 'completed';

export const STUDY_PROJECT_STATUSES: readonly StudyProjectStatus[] = [
  'planned',
  'active',
  'completed',
];

export const STUDY_PROJECT_STATUS_LABELS: Record<StudyProjectStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
};

export const STUDY_PROJECT_STATUS_LABELS_KO: Record<StudyProjectStatus, string> = {
  planned: '계획',
  active: '진행',
  completed: '완료',
};

function isTruthyMarker(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === 'yes' || v === 'true' || v === '1';
}

export function isStudyProjectStatus(value: string): value is StudyProjectStatus {
  return STUDY_PROJECT_STATUSES.includes(value as StudyProjectStatus);
}

export function isStudyProjectContainer(note: NoteBase): boolean {
  return isTruthyMarker(getProperty(note, STUDY_PROJECT_MARKER));
}

export function getStudyProjectStatus(note: NoteBase): StudyProjectStatus | null {
  if (!isStudyProjectContainer(note)) return null;
  const raw = getProperty(note, STUDY_PROJECT_STATUS_PROPERTY)?.trim().toLowerCase();
  return raw && isStudyProjectStatus(raw) ? raw : 'planned';
}

export function getStudyProjectDescription(note: NoteBase): string {
  return getProperty(note, STUDY_PROJECT_DESCRIPTION_PROPERTY)?.trim() ?? '';
}

export function getLinkedStudyProjectId(note: NoteBase): string | null {
  const raw = getProperty(note, STUDY_PROJECT_LINK_PROPERTY)?.trim();
  return raw || null;
}

export function setStudyProjectContainer(
  note: NoteBase,
  status: StudyProjectStatus,
  description?: string,
): NoteBase {
  let result = setProperty(note, STUDY_PROJECT_MARKER, 'yes');
  result = setProperty(result, STUDY_PROJECT_STATUS_PROPERTY, status);
  if (description !== undefined) {
    result = description.trim()
      ? setProperty(result, STUDY_PROJECT_DESCRIPTION_PROPERTY, description.trim())
      : removeProperty(result, STUDY_PROJECT_DESCRIPTION_PROPERTY);
  }
  return result;
}

export function linkNoteToStudyProject(note: NoteBase, projectId: string): NoteBase {
  return setProperty(note, STUDY_PROJECT_LINK_PROPERTY, projectId.trim());
}

export function unlinkNoteFromStudyProject(note: NoteBase): NoteBase {
  return removeProperty(note, STUDY_PROJECT_LINK_PROPERTY);
}

export function filterStudyProjectContainers(
  notes: readonly NoteBase[],
  status?: StudyProjectStatus,
): NoteBase[] {
  return notes.filter(n => {
    if (n.deletedAt || !isStudyProjectContainer(n)) return false;
    if (!status) return true;
    return getStudyProjectStatus(n) === status;
  });
}

export function filterNotesLinkedToProject(
  notes: readonly NoteBase[],
  projectId: string,
): NoteBase[] {
  return notes.filter(
    n => !n.deletedAt && getLinkedStudyProjectId(n) === projectId,
  );
}

function isProjectMilestoneNote(note: NoteBase): boolean {
  return isTruthyMarker(getProperty(note, 'projectMilestone'));
}

function getProjectMilestoneStatus(note: NoteBase): StudyProjectStatus | null {
  const raw = getProperty(note, 'milestoneStatus')?.trim().toLowerCase();
  return raw && isStudyProjectStatus(raw) ? raw : null;
}

export interface StudyProjectSummary {
  noteId: string;
  title: string;
  description: string;
  status: StudyProjectStatus;
  linkedNoteCount: number;
  conceptCount: number;
  studyNoteCount: number;
  milestoneCount: number;
  completedMilestoneCount: number;
  progressPercent: number;
  lastActivityAt: number;
}

export function buildStudyProjectSummary(
  notes: readonly NoteBase[],
  project: NoteBase,
): StudyProjectSummary {
  const linked = filterNotesLinkedToProject(notes, project.id);
  const milestones = linked.filter(isProjectMilestoneNote);
  const completedMilestones = milestones.filter(
    m => getProjectMilestoneStatus(m) === 'completed',
  );
  const milestoneCount = milestones.length;
  const completedMilestoneCount = completedMilestones.length;
  const progressPercent = milestoneCount > 0
    ? Math.round((completedMilestoneCount / milestoneCount) * 100)
    : 0;
  const lastActivityAt = linked.reduce(
    (max, n) => Math.max(max, n.updatedAt),
    project.updatedAt,
  );

  return {
    noteId: project.id,
    title: displayNoteTitle(project.title),
    description: getStudyProjectDescription(project),
    status: getStudyProjectStatus(project) ?? 'planned',
    linkedNoteCount: linked.filter(n => !isProjectMilestoneNote(n)).length,
    conceptCount: linked.filter(isConceptNote).length,
    studyNoteCount: linked.filter(isStudyNote).length,
    milestoneCount,
    completedMilestoneCount,
    progressPercent,
    lastActivityAt,
  };
}
