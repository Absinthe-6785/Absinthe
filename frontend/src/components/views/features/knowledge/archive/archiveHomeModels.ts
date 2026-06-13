import type { TraceMilestoneRef } from '../trace/dailyTraceModels';

export type ArchiveMarkType =
  | 'note-activity'
  | 'milestone'
  | 'event'
  | 'workout'
  | 'routine'
  | 'scheduled-study'
  | 'exception';

/** One row from heatmap / domain mark feed — aligns with GET /api/heatmap shape */
export interface ArchiveDomainMarkDay {
  date: string;
  workout_count: number;
  routine_done: number;
  routine_total: number;
  study_mins: number;
  is_exception: boolean;
}

export interface ArchiveMarkDay {
  date: string;
  types: readonly ArchiveMarkType[];
  density: number;
}

export interface ArchiveMonthLabel {
  year: number;
  month: number;
  label: string;
  weekIndex: number;
}

export interface ArchiveMarkCalendarProjection {
  startDate: string;
  endDate: string;
  days: readonly ArchiveMarkDay[];
  years: readonly number[];
  monthLabels: readonly ArchiveMonthLabel[];
  weeks?: readonly (readonly string[])[];
  hasAnyMarks: boolean;
}

export type ArchivePeriodKind = 'year' | 'quarter' | 'month' | 'custom' | 'day';

export interface ArchivePeriodRef {
  kind: ArchivePeriodKind;
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  month?: number;
  startDate?: string;
  endDate?: string;
  label: string;
}

export interface ArchiveAreaRef {
  areaNoteId: string;
  title: string;
}

export interface ArchiveMilestoneEntry extends TraceMilestoneRef {
  displayLabel: string;
  periodRef: ArchivePeriodRef;
  areaNoteIds?: readonly string[];
}

export interface ArchiveAreaPill {
  areaNoteId: string;
  title: string;
  markCount: number;
  lastMarkDate: string | null;
  areaRef: ArchiveAreaRef;
}

export interface ArchiveYouAreHere {
  today: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  month: number;
  labels: {
    year: string;
    quarter: string;
    month: string;
    combined: string;
  };
  openPeriod: ArchivePeriodRef;
}

export interface ArchiveBrowseProjection {
  thisYear: ArchivePeriodRef;
  thisQuarter: ArchivePeriodRef;
  thisMonth: ArchivePeriodRef;
  custom: { kind: 'custom'; label: string };
  allAreas: { kind: 'areas-index'; label: string };
  timeline: { kind: 'timeline'; defaultPeriod: ArchivePeriodRef; label: string };
  recentYearsWithMarks?: readonly ArchivePeriodRef[];
}

export interface ArchiveHomeFrame {
  title: string;
  subtitle: string;
  generatedAt: string;
}

export interface ArchiveHomeEmptyFlags {
  noMarks: boolean;
  noMilestones: boolean;
  noAreas: boolean;
  isEmpty: boolean;
}

/** Computed — not persisted. Archive Home read model. */
export interface ArchiveHomeProjection {
  frame: ArchiveHomeFrame;
  youAreHere: ArchiveYouAreHere;
  markCalendar: ArchiveMarkCalendarProjection;
  recentMilestones: readonly ArchiveMilestoneEntry[];
  areaPills: readonly ArchiveAreaPill[];
  browse: ArchiveBrowseProjection;
  empty: ArchiveHomeEmptyFlags;
}

export interface ArchiveHomeProjectionOptions {
  calendarYears?: number;
  recentMilestoneLimit?: number;
  areaLookbackMonths?: number;
  areaPillLimit?: number;
  locale?: string;
}

export interface ArchiveHomeProjectionInput {
  notes: readonly import('../../../noteUtils').NoteBase[];
  now: Date;
  domainMarks?: readonly ArchiveDomainMarkDay[];
  options?: ArchiveHomeProjectionOptions;
}

export const DEFAULT_ARCHIVE_HOME_OPTIONS = {
  calendarYears: 5,
  recentMilestoneLimit: 5,
  areaLookbackMonths: 24,
  areaPillLimit: 8,
} as const satisfies Required<Omit<ArchiveHomeProjectionOptions, 'locale'>>;
