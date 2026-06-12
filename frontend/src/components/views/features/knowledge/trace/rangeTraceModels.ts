import type { TraceEventRef, TraceMilestoneRef } from './dailyTraceModels';

export interface RangeTraceEventRef extends TraceEventRef {
  date: string;
}

/** Computed projection — not persisted */
export interface RangeTraceProjection {
  startDate: string;
  endDate: string;
  milestones: TraceMilestoneRef[];
  events: RangeTraceEventRef[];
  notesTouched: number;
  notesCreated: number;
}

export type TraceRangeLens =
  | { kind: 'month'; year: number; month: number }
  | { kind: 'quarter'; year: number; quarter: 1 | 2 | 3 | 4 }
  | { kind: 'year'; year: number }
  | { kind: 'custom'; startDate: string; endDate: string; label?: string };

/** UI-only label for custom ranges — not part of projection */
export interface TraceCustomRangeDraft {
  startDate: string;
  endDate: string;
  label: string;
}

export const MAX_RANGE_DAYS = 366;
