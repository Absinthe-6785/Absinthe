import type { TraceEventRef, TraceMilestoneRef } from './dailyTraceModels';

export interface MonthTraceActivityOverview {
  notesTouched: number;
  notesCreated: number;
}

/** Computed projection — not persisted */
export interface MonthTraceProjection {
  month: string;
  year: number;
  monthNumber: number;
  milestones: TraceMilestoneRef[];
  events: MonthTraceEventRef[];
  activityOverview: MonthTraceActivityOverview;
}

export interface MonthTraceEventRef extends TraceEventRef {
  date: string;
}
