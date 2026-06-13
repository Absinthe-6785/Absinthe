import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { getProperty, removeProperty, setProperty } from '../properties/noteProperties';
import {
  STUDY_PROJECT_LINK_PROPERTY,
  isStudyProjectContainer,
} from './studyProjectModels';

/** Project-scoped milestone — informational only, no scheduling engine. */
export const PROJECT_MILESTONE_MARKER = 'projectMilestone';
export const MILESTONE_STATUS_PROPERTY = 'milestoneStatus';
export const MILESTONE_TARGET_DATE_PROPERTY = 'milestoneTargetDate';

export type MilestoneStatus = 'planned' | 'active' | 'completed';

export const MILESTONE_STATUSES: readonly MilestoneStatus[] = [
  'planned',
  'active',
  'completed',
];

export const MILESTONE_STATUS_LABELS_KO: Record<MilestoneStatus, string> = {
  planned: '계획',
  active: '진행',
  completed: '완료',
};

function isTruthyMarker(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === 'yes' || v === 'true' || v === '1';
}

export function isMilestoneStatus(value: string): value is MilestoneStatus {
  return MILESTONE_STATUSES.includes(value as MilestoneStatus);
}

export function isProjectMilestone(note: NoteBase): boolean {
  return isTruthyMarker(getProperty(note, PROJECT_MILESTONE_MARKER));
}

export function getMilestoneStatus(note: NoteBase): MilestoneStatus | null {
  if (!isProjectMilestone(note)) return null;
  const raw = getProperty(note, MILESTONE_STATUS_PROPERTY)?.trim().toLowerCase();
  return raw && isMilestoneStatus(raw) ? raw : 'planned';
}

export function getMilestoneTargetDate(note: NoteBase): string | null {
  const raw = getProperty(note, MILESTONE_TARGET_DATE_PROPERTY)?.trim();
  return raw || null;
}

export function getMilestoneProjectId(note: NoteBase): string | null {
  const raw = getProperty(note, STUDY_PROJECT_LINK_PROPERTY)?.trim();
  return raw || null;
}

export function setProjectMilestone(
  note: NoteBase,
  projectId: string,
  status: MilestoneStatus,
  targetDate?: string,
): NoteBase {
  let result = setProperty(note, PROJECT_MILESTONE_MARKER, 'yes');
  result = setProperty(result, STUDY_PROJECT_LINK_PROPERTY, projectId.trim());
  result = setProperty(result, MILESTONE_STATUS_PROPERTY, status);
  if (targetDate?.trim()) {
    result = setProperty(result, MILESTONE_TARGET_DATE_PROPERTY, targetDate.trim());
  } else {
    result = removeProperty(result, MILESTONE_TARGET_DATE_PROPERTY);
  }
  return result;
}

export function filterProjectMilestones(
  notes: readonly NoteBase[],
  projectId?: string,
): NoteBase[] {
  return notes.filter(n => {
    if (n.deletedAt || !isProjectMilestone(n)) return false;
    if (!projectId) return true;
    return getMilestoneProjectId(n) === projectId;
  });
}

export interface ProjectMilestoneEntry {
  noteId: string;
  title: string;
  status: MilestoneStatus;
  targetDate: string | null;
  projectId: string | null;
  projectTitle: string;
  meta: string;
}

function parseDateKey(value: string): number {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
}

export function buildProjectMilestoneEntry(
  note: NoteBase,
  projectTitle = '',
): ProjectMilestoneEntry {
  const status = getMilestoneStatus(note) ?? 'planned';
  const targetDate = getMilestoneTargetDate(note);
  const parts = [
    MILESTONE_STATUS_LABELS_KO[status],
    targetDate ? `목표 ${targetDate}` : null,
  ].filter(Boolean);
  return {
    noteId: note.id,
    title: displayNoteTitle(note.title),
    status,
    targetDate,
    projectId: getMilestoneProjectId(note),
    projectTitle,
    meta: parts.join(' · ') || '마일스톤',
  };
}

/** Upcoming milestones sorted by target date — informational only. */
export function buildUpcomingMilestones(
  notes: readonly NoteBase[],
  opts: { limit?: number; includeCompleted?: boolean } = {},
): ProjectMilestoneEntry[] {
  const limit = opts.limit ?? 6;
  const projectTitles = new Map<string, string>();
  for (const note of notes) {
    if (isStudyProjectContainer(note)) {
      projectTitles.set(note.id, displayNoteTitle(note.title));
    }
  }

  return filterProjectMilestones(notes)
    .filter(n => opts.includeCompleted || getMilestoneStatus(n) !== 'completed')
    .sort((a, b) => {
      const dateA = getMilestoneTargetDate(a);
      const dateB = getMilestoneTargetDate(b);
      if (dateA && dateB) return parseDateKey(dateA) - parseDateKey(dateB);
      if (dateA) return -1;
      if (dateB) return 1;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, limit)
    .map(n => buildProjectMilestoneEntry(
      n,
      projectTitles.get(getMilestoneProjectId(n) ?? '') ?? '',
    ));
}
