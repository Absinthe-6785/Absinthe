import type { CopyTraceReport } from './copyDiagnostics';

let lastCopyTraceReport: CopyTraceReport | null = null;

export function setLastCopyTraceReport(report: CopyTraceReport | null): void {
  lastCopyTraceReport = report;
}

export function getLastCopyTraceReport(): CopyTraceReport | null {
  return lastCopyTraceReport;
}
