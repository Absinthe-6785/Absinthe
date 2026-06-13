import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { isConceptNote } from '../research/noteClassification';
import { isStudyNote } from '../study/studyNoteTemplate';
import {
  buildStudyProjectSummary,
  filterNotesLinkedToProject,
  filterStudyProjectContainers,
  STUDY_PROJECT_STATUS_LABELS_KO,
  type StudyProjectSummary,
  type StudyProjectStatus,
} from './studyProjectModels';

export interface ProjectNoteEntry {
  noteId: string;
  noteTitle: string;
  meta: string;
}

export interface ProjectDashboardEntry extends StudyProjectSummary {
  linkedNotes: ProjectNoteEntry[];
  conceptNotes: ProjectNoteEntry[];
  studyNotes: ProjectNoteEntry[];
  progressLabel: string;
}

export interface ProjectDashboardData {
  activeProjects: ProjectDashboardEntry[];
  plannedProjects: ProjectDashboardEntry[];
  completedProjects: ProjectDashboardEntry[];
}

export interface BuildProjectDashboardOptions {
  limit?: number;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function toEntry(note: NoteBase, meta: string): ProjectNoteEntry {
  return {
    noteId: note.id,
    noteTitle: displayNoteTitle(note.title),
    meta,
  };
}

function buildProjectEntry(
  notes: readonly NoteBase[],
  project: NoteBase,
  limit: number,
): ProjectDashboardEntry {
  const summary = buildStudyProjectSummary(notes, project);
  const linked = filterNotesLinkedToProject(notes, project.id)
    .filter(n => !getPropertyIsMilestone(n))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const linkedNotes = linked.slice(0, limit).map(n =>
    toEntry(n, `수정 ${formatDate(n.updatedAt)}`),
  );
  const conceptNotes = linked
    .filter(isConceptNote)
    .slice(0, limit)
    .map(n => toEntry(n, '개념'));
  const studyNotes = linked
    .filter(isStudyNote)
    .slice(0, limit)
    .map(n => toEntry(n, '학습'));

  const progressLabel = summary.milestoneCount > 0
    ? `마일스톤 ${summary.completedMilestoneCount}/${summary.milestoneCount}`
    : `연결 노트 ${summary.linkedNoteCount}`;

  return {
    ...summary,
    linkedNotes,
    conceptNotes,
    studyNotes,
    progressLabel,
  };
}

function getPropertyIsMilestone(note: NoteBase): boolean {
  const raw = note.properties?.projectMilestone;
  if (typeof raw !== 'string') return false;
  const v = raw.trim().toLowerCase();
  return v === 'yes' || v === 'true' || v === '1';
}

function projectsByStatus(
  notes: readonly NoteBase[],
  status: StudyProjectStatus,
  limit: number,
): ProjectDashboardEntry[] {
  return filterStudyProjectContainers(notes, status)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(p => buildProjectEntry(notes, p, limit));
}

/** Vault-wide project dashboard — no task manager, no gantt. */
export function buildProjectDashboard(
  notes: readonly NoteBase[],
  opts: BuildProjectDashboardOptions = {},
): ProjectDashboardData {
  const limit = opts.limit ?? 6;
  return {
    activeProjects: projectsByStatus(notes, 'active', limit),
    plannedProjects: projectsByStatus(notes, 'planned', limit),
    completedProjects: projectsByStatus(notes, 'completed', limit),
  };
}

export function formatProjectStatusLabel(status: StudyProjectStatus): string {
  return STUDY_PROJECT_STATUS_LABELS_KO[status];
}
