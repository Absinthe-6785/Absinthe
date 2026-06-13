/**
 * Cross-tab trace navigation — open Notes trace lenses from Archive (K-30.35).
 */
import type { ArchiveBrowseDestination } from '../components/views/features/archive/home/archiveBrowsePresentation';
import { archivePeriodRefToTraceRangeLens } from '../components/views/features/knowledge/archive/archivePeriodRefBridge';
import type { TraceRangeLens } from '../components/views/features/knowledge/trace/rangeTraceModels';
import { switchToNotesTab } from './noteNavigation';

export interface TraceNavigationHandlers {
  openTraceDay: (dateKey: string) => void;
  openTraceRange: (lens: TraceRangeLens) => void;
  openTraceDiscovery: () => void;
}

let traceHandlers: TraceNavigationHandlers | null = null;

export function registerTraceNavigation(handlers: TraceNavigationHandlers): () => void {
  traceHandlers = handlers;
  return () => {
    if (traceHandlers === handlers) traceHandlers = null;
  };
}

export function peekTraceNavigationHandlers(): TraceNavigationHandlers | null {
  return traceHandlers;
}

export function openTraceDayNavigation(dateKey: string): void {
  if (!dateKey.trim()) return;
  traceHandlers?.openTraceDay(dateKey);
  switchToNotesTab();
}

export function openTraceRangeNavigation(lens: TraceRangeLens): void {
  traceHandlers?.openTraceRange(lens);
  switchToNotesTab();
}

export function openTraceDiscoveryNavigation(): void {
  traceHandlers?.openTraceDiscovery();
  switchToNotesTab();
}

/** Maps Archive Home browse destinations to Notes trace lenses. */
export function openArchiveBrowseDestination(destination: ArchiveBrowseDestination): void {
  switch (destination.type) {
    case 'period': {
      const lens = archivePeriodRefToTraceRangeLens(destination.ref);
      if (lens) openTraceRangeNavigation(lens);
      break;
    }
    case 'timeline': {
      const lens = archivePeriodRefToTraceRangeLens(destination.defaultPeriod);
      if (lens) openTraceRangeNavigation(lens);
      break;
    }
    case 'areas-index':
      openTraceDiscoveryNavigation();
      break;
    case 'custom':
      openTraceRangeNavigation({ kind: 'custom', startDate: '', endDate: '', label: '' });
      break;
    default:
      break;
  }
}

export function openArchiveMarkMonthNavigation(year: number, month: number): void {
  openTraceRangeNavigation({ kind: 'month', year, month });
}
