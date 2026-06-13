import type { NoteBase } from '../../../noteUtils';
import { daysSince } from '../review/staleNotes';
import {
  buildStudyProjectSummary,
  filterStudyProjectContainers,
  type StudyProjectStatus,
} from '../academic/studyProjectModels';

/** Days without linked-note or project activity before a project is considered stalled. */
export const STALLED_PROJECT_DAYS = 14;

export type ProjectHealthIndicator = 'active' | 'stalled' | 'on-track';

export interface ProjectHealthEntry {
  noteId: string;
  title: string;
  status: StudyProjectStatus;
  indicator: ProjectHealthIndicator;
  milestoneLabel: string;
  lastActivityAt: number;
  daysSinceActivity: number;
  meta: string;
}

export interface ProjectHealthData {
  activeProjects: ProjectHealthEntry[];
  stalledProjects: ProjectHealthEntry[];
  recentActivity: ProjectHealthEntry[];
}

export interface BuildProjectHealthOptions {
  limit?: number;
  stalledDays?: number;
  now?: number;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function toHealthEntry(
  notes: readonly NoteBase[],
  project: NoteBase,
  now: number,
  stalledDays: number,
): ProjectHealthEntry {
  const summary = buildStudyProjectSummary(notes, project);
  const daysInactive = daysSince(summary.lastActivityAt, now);
  const indicator: ProjectHealthIndicator = summary.status !== 'active'
    ? 'on-track'
    : daysInactive >= stalledDays
      ? 'stalled'
      : 'active';
  const milestoneLabel = summary.milestoneCount > 0
    ? `${summary.completedMilestoneCount}/${summary.milestoneCount} 마일스톤`
    : `${summary.linkedNoteCount} 연결 노트`;

  return {
    noteId: summary.noteId,
    title: summary.title,
    status: summary.status,
    indicator,
    milestoneLabel,
    lastActivityAt: summary.lastActivityAt,
    daysSinceActivity: daysInactive,
    meta: `${milestoneLabel} · ${formatDate(summary.lastActivityAt)}`,
  };
}

/** Project health indicators only — no health score. */
export function buildProjectHealth(
  notes: readonly NoteBase[],
  opts: BuildProjectHealthOptions = {},
): ProjectHealthData {
  const limit = opts.limit ?? 6;
  const stalledDays = opts.stalledDays ?? STALLED_PROJECT_DAYS;
  const now = opts.now ?? Date.now();

  const active = filterStudyProjectContainers(notes, 'active')
    .map(p => toHealthEntry(notes, p, now, stalledDays))
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);

  const stalledProjects = active
    .filter(p => p.indicator === 'stalled')
    .slice(0, limit);

  const recentActivity = active.slice(0, limit);

  return {
    activeProjects: active.slice(0, limit),
    stalledProjects,
    recentActivity,
  };
}
