/** K-28 property key conventions — trace layer over notes */
export const TRACE_PROPERTY_KEYS = {
  TYPE: 'type',
  EVENT_DATE: 'eventDate',
  EVENT_TIME: 'eventTime',
  EVENT_END_DATE: 'eventEndDate',
  EVENT_END_TIME: 'eventEndTime',
  MILESTONE_DATE: 'milestoneDate',
  MILESTONE_KIND: 'milestoneKind',
  MILESTONE_LABEL: 'milestoneLabel',
  TRACE_DATE: 'traceDate',
} as const;

export const EVENT_TYPE_VALUE = 'event';

export type TraceActivityKind = 'created' | 'edited';

export interface TraceActivity {
  noteId: string;
  title: string;
  kind: TraceActivityKind;
  /** Local time-of-day when known (HH:mm) */
  at?: string;
}

export interface TraceEventRef {
  noteId: string;
  title: string;
  time?: string;
  endDate?: string;
}

export interface TraceMilestoneRef {
  noteId: string;
  label: string;
  kind: string;
  date: string;
}

/** Computed projection — not persisted */
export interface DailyTraceProjection {
  date: string;
  milestones: TraceMilestoneRef[];
  events: TraceEventRef[];
  activities: TraceActivity[];
}
