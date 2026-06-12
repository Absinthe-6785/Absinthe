import type { TraceRangeLens } from '../trace/rangeTraceModels';
import { getQuarterBounds, getYearBounds, toMonthKey } from '../trace/buildRangeTraceProjection';
import type { ArchivePeriodRef } from './archiveHomeModels';

export function archivePeriodRefToTraceRangeLens(ref: ArchivePeriodRef): TraceRangeLens | null {
  switch (ref.kind) {
    case 'month':
      if (ref.year == null || ref.month == null) return null;
      return { kind: 'month', year: ref.year, month: ref.month };
    case 'quarter':
      if (ref.year == null || ref.quarter == null) return null;
      return { kind: 'quarter', year: ref.year, quarter: ref.quarter };
    case 'year':
      if (ref.year == null) return null;
      return { kind: 'year', year: ref.year };
    case 'custom':
      if (!ref.startDate?.trim() || !ref.endDate?.trim()) return null;
      return {
        kind: 'custom',
        startDate: ref.startDate,
        endDate: ref.endDate,
        label: ref.label,
      };
    case 'day':
      if (!ref.startDate?.trim()) return null;
      return {
        kind: 'custom',
        startDate: ref.startDate,
        endDate: ref.endDate ?? ref.startDate,
        label: ref.label,
      };
    default:
      return null;
  }
}

export function traceRangeLensToArchivePeriodRef(lens: TraceRangeLens): ArchivePeriodRef {
  switch (lens.kind) {
    case 'month':
      return {
        kind: 'month',
        year: lens.year,
        month: lens.month,
        label: `${lens.year}-${String(lens.month).padStart(2, '0')}`,
      };
    case 'quarter':
      return {
        kind: 'quarter',
        year: lens.year,
        quarter: lens.quarter,
        label: `Q${lens.quarter} ${lens.year}`,
      };
    case 'year':
      return {
        kind: 'year',
        year: lens.year,
        label: String(lens.year),
      };
    case 'custom': {
      const bounds = lens.startDate && lens.endDate
        ? { startDate: lens.startDate, endDate: lens.endDate }
        : null;
      return {
        kind: 'custom',
        startDate: lens.startDate,
        endDate: lens.endDate,
        label: lens.label?.trim() || 'Custom Range',
        ...bounds,
      };
    }
    default:
      return { kind: 'custom', label: 'Custom Range' };
  }
}

export function resolveArchivePeriodBounds(ref: ArchivePeriodRef): { startDate: string; endDate: string } | null {
  switch (ref.kind) {
    case 'month':
      if (ref.year == null || ref.month == null) return null;
      return {
        startDate: `${toMonthKey(ref.year, ref.month)}-01`,
        endDate: `${toMonthKey(ref.year, ref.month)}-${String(new Date(ref.year, ref.month, 0).getDate()).padStart(2, '0')}`,
      };
    case 'quarter':
      if (ref.year == null || ref.quarter == null) return null;
      return getQuarterBounds(ref.year, ref.quarter);
    case 'year':
      if (ref.year == null) return null;
      return getYearBounds(ref.year);
    case 'custom':
    case 'day':
      if (!ref.startDate?.trim() || !ref.endDate?.trim()) {
        if (ref.startDate?.trim()) {
          return { startDate: ref.startDate, endDate: ref.endDate ?? ref.startDate };
        }
        return null;
      }
      return { startDate: ref.startDate, endDate: ref.endDate };
    default:
      return null;
  }
}
