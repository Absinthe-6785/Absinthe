/**
 * K-132A — Home foundation projection (composition only, no new stores).
 */
import type { Language } from '../../../../lib/i18n';
import type { NoteBase } from '../../noteUtils';
import type { Routine, Workout } from '../../../../types';
import { displayNoteTitleForLocale } from '../../noteDisplayTitle';
import { loadWorkspaceSession } from '../knowledge/workspace/workspaceSessionStorage';
import { loadWorkspacePreferences } from '../knowledge/workspace/workspacePreferencesStorage';
import type { PlannerProjection } from '../planner/calendar/buildPlannerProjection';
import type { RecentActivityProjection } from '../../buildRecentActivityProjection';
import type { ArchiveHistoryProjection } from '../knowledge/archive/archiveProjectionModels';
import type { WorkspaceActivation } from '../knowledge/workspace/workspaceModels';
import type { HomeContinueItem, HomeFoundationProjection, HomeWorkoutSummary } from './homeFoundationModels';
import { readLocalHealthWorkoutDraft } from '../../../../lib/healthBackfillUiSafety';

function summarizeWorkouts(workouts: readonly Workout[]): Omit<HomeWorkoutSummary, 'hasSession' | 'isDraft' | 'isLocked'> {
  const exerciseCount = workouts.filter(w => w.block_id !== '__session__').length;
  const setCount = workouts.reduce(
    (total, w) => total + (w.block_id === '__session__' ? 0 : w.sets.length),
    0,
  );
  const doneCount = workouts.reduce(
    (total, w) => total + (w.block_id === '__session__' ? 0 : w.sets.filter(s => s.done).length),
    0,
  );
  return { exerciseCount, setCount, doneCount };
}

function buildContinueItem(
  notes: readonly NoteBase[],
  locale?: Language | null,
): HomeContinueItem | null {
  const session = loadWorkspaceSession();
  const resumeActivation = session?.resumeActivation;
  if (
    resumeActivation
    && resumeActivation.kind !== 'none'
    && resumeActivation.kind !== 'dashboard'
  ) {
    const recent = loadWorkspacePreferences().recent.find(
      entry => entry.workspace.kind === resumeActivation.kind
        && entry.workspace.id === resumeActivation.id,
    );
    return {
      kind: 'workspace',
      title: recent?.workspace.name ?? resumeActivation.kind.replace('-', ' '),
      subtitle: recent?.workspace.subtitle,
      workspaceActivation: resumeActivation,
    };
  }

  const lastOpened = [...notes]
    .filter(note => !note.deletedAt && note.lastOpenedAt)
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0];
  if (lastOpened) {
    return {
      kind: 'note',
      title: displayNoteTitleForLocale(lastOpened.title, locale ?? undefined),
      noteId: lastOpened.id,
    };
  }

  const recentWork = loadWorkspacePreferences().recent[0];
  if (recentWork) {
    return {
      kind: 'workspace',
      title: recentWork.workspace.name,
      subtitle: recentWork.workspace.subtitle,
      workspaceActivation: {
        kind: recentWork.workspace.kind,
        id: recentWork.workspace.id,
      } as WorkspaceActivation,
    };
  }

  return null;
}

function buildWorkoutSummary(
  workouts: readonly Workout[],
  accountId: string,
  todayKey: string,
): HomeWorkoutSummary {
  const loadedDraft = readLocalHealthWorkoutDraft(localStorage, accountId, todayKey);
  const draft = loadedDraft && loadedDraft.length > 0 ? loadedDraft : null;
  const active = draft ?? workouts;
  const summary = summarizeWorkouts(active);
  return {
    ...summary,
    hasSession: active.length > 0,
    isDraft: Boolean(draft),
    isLocked: !draft && workouts.length > 0,
  };
}

function flattenArchiveTracesToday(history: ArchiveHistoryProjection | null | undefined): number {
  if (!history) return 0;
  const today = history.groups.find(group => group.bucket === 'today');
  if (!today) return 0;
  return today.opened.length + today.edited.length + today.restored.length;
}

export function buildHomeFoundationProjection(input: {
  notes: readonly NoteBase[];
  routines: readonly Routine[];
  workouts: readonly Workout[];
  plannerProjection: PlannerProjection | null;
  recentActivity: RecentActivityProjection;
  archiveHistory?: ArchiveHistoryProjection | null;
  accountId: string;
  todayKey: string;
  locale?: Language | null;
  traceLimit?: number;
}): HomeFoundationProjection {
  const activeRoutines = input.routines.filter(routine => routine.is_active);
  const completedRoutines = activeRoutines.filter(routine => routine.done).length;
  const traces = input.recentActivity.groups.find(group => group.bucket === 'today')?.items
    .slice(0, input.traceLimit ?? 6) ?? [];

  return {
    continueItem: buildContinueItem(input.notes, input.locale),
    todayAgenda: input.plannerProjection?.todayItems ?? [],
    timetableSlots: input.plannerProjection?.timetableToday ?? [],
    activeRoutines: activeRoutines.length,
    completedRoutines,
    workout: buildWorkoutSummary(input.workouts, input.accountId, input.todayKey),
    traces,
    archiveTracesToday: flattenArchiveTracesToday(input.archiveHistory),
  };
}
