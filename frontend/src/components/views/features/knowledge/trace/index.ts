export {
  TRACE_PROPERTY_KEYS,
  EVENT_TYPE_VALUE,
  type TraceActivityKind,
  type TraceActivity,
  type TraceEventRef,
  type TraceMilestoneRef,
  type DailyTraceProjection,
} from './dailyTraceModels';

export type {
  RangeTraceEventRef,
  RangeTraceProjection,
  TraceCustomRangeDraft,
  TraceRangeLens,
} from './rangeTraceModels';

export { MAX_RANGE_DAYS } from './rangeTraceModels';

export { buildDailyTraceProjection } from './buildDailyTraceProjection';
export {
  buildRangeTraceProjection,
  buildRangeLensProjection,
  buildMonthTraceProjection,
  buildQuarterTraceProjection,
  buildYearTraceProjection,
  currentTraceMonth,
  currentTraceQuarter,
  currentTraceYear,
  enumerateDateKeys,
  formatRangeLensHeading,
  formatTraceMonthHeading,
  formatTraceQuarterHeading,
  formatTraceYearHeading,
  getQuarterBounds,
  getYearBounds,
  hasRangeTraceMarks,
  hasMonthTraceMarks,
  rangeTraceMarkCount,
  monthTraceMarkCount,
  resolveRangeLensBounds,
  shiftTraceMonth,
  shiftTraceQuarter,
  shiftTraceYear,
  toMonthKey,
  type TraceMonthKey,
  type TraceQuarterKey,
} from './buildRangeTraceProjection';
export { DailyTraceDayView, type DailyTraceDayViewProps } from './DailyTraceDayView';
export { RangeTraceLensView, type RangeTraceLensViewProps } from './RangeTraceLensView';
export { AreaTraceView, type AreaTraceViewProps } from './AreaTraceView';
export { EventNoteDialog, type EventNoteDialogProps } from './EventNoteDialog';
export { MilestoneNoteDialog, type MilestoneNoteDialogProps } from './MilestoneNoteDialog';
export {
  applyEventToNote,
  clearEventFromNote,
  eventFormValuesFromNote,
  isEventNote,
  readEventFromNote,
  validateEventForm,
  type EventFormValues,
} from './eventNotes';
export {
  applyMilestoneToNote,
  clearMilestoneFromNote,
  isMilestoneNote,
  milestoneFormValuesFromNote,
  readMilestoneFromNote,
  validateMilestoneForm,
  type MilestoneFormValues,
} from './milestoneNotes';
export {
  findDailyAnchorNote,
  formatTraceDayHeading,
  hasDailyTraceMarks,
  shiftDateKey,
} from './dailyTraceDayHelpers';
export {
  AREA_TYPE_VALUE,
  applyAreaToNote,
  canMarkAsArea,
  clearAreaFromNote,
  isAreaNote,
  listAreaNotes,
} from './areaNotes';
export type {
  AreaTraceEventRef,
  AreaTraceLinkedNote,
  AreaTraceProjection,
  AreaRangeTraceProjection,
} from './areaTraceModels';
export {
  areaRangeTraceMarkCount,
  buildAreaRangeLensProjection,
  buildAreaRangeTraceProjection,
  formatAreaRangeHeading,
  hasAreaRangeTraceMarks,
} from './buildAreaRangeTraceProjection';
export {
  areaTraceMarkCount,
  buildAreaTraceProjection,
  hasAreaTraceMarks,
  resolveAreaMembership,
  type AreaMembership,
} from './buildAreaTraceProjection';
