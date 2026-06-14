import type { KnowledgeHistoryEvent } from './eventTypes';
import { IMPORTED_METADATA_KEY, IMPORTED_METADATA_VALUE } from './historyBootstrap';

export const BOOTSTRAP_SUMMARY_STORAGE_KEY = 'absinthe:knowledge-history-bootstrap-summary:v1';
export const BOOTSTRAP_SUMMARY_DISMISSED_KEY = 'absinthe:knowledge-history-bootstrap-summary-dismissed:v1';

export interface BootstrapImportSummary {
  notesImported: number;
  linksImported: number;
  areasImported: number;
  hubsImported: number;
  seededAt: number;
}

function hasLocalStorage(): boolean {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis;
}

export function saveBootstrapImportSummary(summary: BootstrapImportSummary): void {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.setItem(BOOTSTRAP_SUMMARY_STORAGE_KEY, JSON.stringify(summary));
  } catch {
    // Ignore.
  }
}

export function loadBootstrapImportSummary(): BootstrapImportSummary | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = globalThis.localStorage.getItem(BOOTSTRAP_SUMMARY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BootstrapImportSummary;
  } catch {
    return null;
  }
}

export function isBootstrapSummaryDismissed(): boolean {
  if (!hasLocalStorage()) return true;
  try {
    return globalThis.localStorage.getItem(BOOTSTRAP_SUMMARY_DISMISSED_KEY) === '1';
  } catch {
    return true;
  }
}

export function dismissBootstrapSummary(): void {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.setItem(BOOTSTRAP_SUMMARY_DISMISSED_KEY, '1');
  } catch {
    // Ignore.
  }
}

export function shouldShowBootstrapSummary(): boolean {
  if (isBootstrapSummaryDismissed()) return false;
  return loadBootstrapImportSummary() != null;
}

export function buildBootstrapImportSummaryFromEvents(
  events: readonly KnowledgeHistoryEvent[],
): BootstrapImportSummary {
  const imported = events.filter(e => e.metadata?.[IMPORTED_METADATA_KEY] === IMPORTED_METADATA_VALUE);
  const areas = new Set<string>();
  for (const e of imported) {
    const label = e.areaId ?? e.metadata?.areaLabel;
    if (label && (e.type === 'AREA_ASSIGNED' || e.type === 'HUB_CREATED')) areas.add(label);
  }
  return {
    notesImported: imported.filter(e => e.type === 'NOTE_CREATED').length,
    linksImported: imported.filter(e => e.type === 'LINK_CREATED').length,
    areasImported: areas.size,
    hubsImported: imported.filter(e => e.type === 'HUB_CREATED').length,
    seededAt: Date.now(),
  };
}
