import type { WorkspaceActivation } from '../knowledge/workspace/workspaceModels';
import type { UnifiedAgendaItem } from '../planner/calendar-ui/agenda/agendaItemModel';
import type { PlannerWeeklySlotRow } from '../planner/calendar/calendarModels';
import type { RecentActivityItem } from '../../buildRecentActivityProjection';
import type { HomeWorkoutCompositeProjection } from './homeWorkoutCompositeProjection';

export type HomeContinueKind = 'note' | 'workspace';

export interface HomeContinueItem {
  kind: HomeContinueKind;
  title: string;
  subtitle?: string;
  noteId?: string;
  workspaceActivation?: WorkspaceActivation;
}

export interface HomeWorkoutSummary {
  mode?: 'legacy';
  hasSession: boolean;
  isDraft: boolean;
  isLocked: boolean;
  exerciseCount: number;
  setCount: number;
  doneCount: number;
}

export interface HomeFoundationProjection {
  continueItem: HomeContinueItem | null;
  todayAgenda: readonly UnifiedAgendaItem[];
  timetableSlots: readonly PlannerWeeklySlotRow[];
  activeRoutines: number;
  completedRoutines: number;
  workout: HomeWorkoutSummary | HomeWorkoutCompositeProjection;
  traces: readonly RecentActivityItem[];
  archiveTracesToday: number;
}
