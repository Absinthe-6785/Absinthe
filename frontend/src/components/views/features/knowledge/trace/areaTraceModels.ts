import type { TraceEventRef, TraceMilestoneRef } from './dailyTraceModels';

export interface AreaTraceLinkedNote {
  noteId: string;
  title: string;
  updatedAt: number;
}

export interface AreaTraceEventRef extends TraceEventRef {
  date: string;
}

/** Computed projection — not persisted */
export interface AreaTraceProjection {
  areaNoteId: string;
  areaTitle: string;
  linkedNotes: AreaTraceLinkedNote[];
  milestones: TraceMilestoneRef[];
  events: AreaTraceEventRef[];
}

/** Area scoped to a calendar range — derived only */
export interface AreaRangeTraceProjection {
  areaNoteId: string;
  areaTitle: string;
  startDate: string;
  endDate: string;
  linkedNotes: AreaTraceLinkedNote[];
  milestones: TraceMilestoneRef[];
  events: AreaTraceEventRef[];
  notesTouched: number;
  notesCreated: number;
}
