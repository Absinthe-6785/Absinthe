/**
 * Knowledge-17.0 — Forward-looking database presentation types.
 *
 * Architecture-only in K-17.0; implementation lands in K-17.5+.
 * Does not extend runtime DatabaseViewPresentation until views are implemented.
 */

import type { FormulaColumnDefinition } from '../formulas/formulaModels';
import type { RollupColumnDefinition } from '../rollups/rollupModels';
import type {
  DatabaseBoardConfig,
  DatabaseCalendarConfig,
  DatabasePresentationConfig,
  DatabaseTableConfig,
} from './databasePresentationModels';
import type { DatabaseViewPresentation } from './databaseViewModels';

/** Implemented presentation modes */
export type DatabaseViewPresentationImplemented = DatabaseViewPresentation;

/** Planned presentation modes — K-17.5+ */
export type DatabaseViewPresentationFuture =
  | DatabaseViewPresentationImplemented
  | 'timeline'
  | 'gallery';

/** Timeline bar sort key */
export type DatabaseTimelineSortBy = 'start' | 'end' | 'title';

/** Timeline presentation config — K-17.5+ */
export interface DatabaseTimelineConfig {
  type: 'timeline';
  /** Property or metadata key for range start, e.g. "startDate", "updatedAt" */
  startDateProperty: string;
  /** Optional range end — omit for point-in-time events */
  endDateProperty?: string;
  sortBy?: DatabaseTimelineSortBy;
  /** Label for notes without parseable start date */
  unscheduledLabel?: string;
  /** Optional rollup badges on timeline bars */
  barRollups?: RollupColumnDefinition[];
  /** Optional formula badges on timeline bars */
  barFormulas?: FormulaColumnDefinition[];
}

/** Gallery card size preset */
export type DatabaseGalleryCardSize = 'compact' | 'medium' | 'large';

/** Gallery grid presentation config — K-17.75+ */
export interface DatabaseGalleryConfig {
  type: 'gallery';
  /** Property key for cover image URL — optional */
  coverProperty?: string;
  /** Property keys on cards — same semantics as board cardFields */
  cardFields?: string[];
  cardSize?: DatabaseGalleryCardSize;
  /** Optional rollup badges on gallery cards */
  cardRollups?: RollupColumnDefinition[];
  /** Optional formula badges on gallery cards */
  cardFormulas?: FormulaColumnDefinition[];
}

/** Multi-column sort rule — K-18+ */
export type { DatabaseViewSortRule } from './databasePresentationModels';

/** Table grouped-section config — K-18+ optional enhancement */
export interface DatabaseTableGroupConfig {
  groupBy: string;
  /** Fixed group order; when omitted, derive from distinct values */
  groupOrder?: string[];
  collapsed?: string[];
}

/** Full presentation config union including future modes */
export type DatabasePresentationConfigFuture =
  | DatabasePresentationConfig
  | DatabaseTimelineConfig
  | DatabaseGalleryConfig;

const TIMELINE_SORT_KEYS: readonly DatabaseTimelineSortBy[] = ['start', 'end', 'title'];
const GALLERY_CARD_SIZES: readonly DatabaseGalleryCardSize[] = ['compact', 'medium', 'large'];

export function isDatabaseTimelineConfig(
  config: DatabasePresentationConfigFuture,
): config is DatabaseTimelineConfig {
  return config.type === 'timeline'
    && typeof config.startDateProperty === 'string'
    && config.startDateProperty.trim().length > 0;
}

export function isDatabaseGalleryConfig(
  config: DatabasePresentationConfigFuture,
): config is DatabaseGalleryConfig {
  return config.type === 'gallery';
}

export function isDatabasePresentationConfigFuture(
  value: unknown,
): value is DatabasePresentationConfigFuture {
  if (!value || typeof value !== 'object') return false;
  const record = value as { type?: string };
  switch (record.type) {
    case 'table':
    case 'board':
    case 'calendar':
    case 'timeline':
    case 'gallery':
      return true;
    default:
      return false;
  }
}

/** Normalize timeline config — structure validation only */
export function normalizeTimelineConfig(raw: unknown): DatabaseTimelineConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<DatabaseTimelineConfig>;
  if (record.type !== 'timeline') return null;

  const startDateProperty = typeof record.startDateProperty === 'string'
    ? record.startDateProperty.trim()
    : '';
  if (!startDateProperty) return null;

  const config: DatabaseTimelineConfig = {
    type: 'timeline',
    startDateProperty,
  };

  if (typeof record.endDateProperty === 'string' && record.endDateProperty.trim()) {
    config.endDateProperty = record.endDateProperty.trim();
  }
  if (record.sortBy && (TIMELINE_SORT_KEYS as readonly string[]).includes(record.sortBy)) {
    config.sortBy = record.sortBy;
  }
  if (typeof record.unscheduledLabel === 'string' && record.unscheduledLabel.trim()) {
    config.unscheduledLabel = record.unscheduledLabel.trim();
  }

  return config;
}

/** Normalize gallery config — structure validation only */
export function normalizeGalleryConfig(raw: unknown): DatabaseGalleryConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<DatabaseGalleryConfig>;
  if (record.type !== 'gallery') return null;

  const config: DatabaseGalleryConfig = { type: 'gallery' };

  if (typeof record.coverProperty === 'string' && record.coverProperty.trim()) {
    config.coverProperty = record.coverProperty.trim();
  }
  if (Array.isArray(record.cardFields)) {
    const cardFields = record.cardFields
      .filter(field => typeof field === 'string' && field.trim())
      .map(field => field.trim());
    if (cardFields.length > 0) config.cardFields = cardFields;
  }
  if (record.cardSize && (GALLERY_CARD_SIZES as readonly string[]).includes(record.cardSize)) {
    config.cardSize = record.cardSize;
  }

  return config;
}

/** Map presentation enum to config discriminant — includes future modes */
export function presentationConfigTypeForPresentation(
  presentation: DatabaseViewPresentationFuture,
): DatabasePresentationConfigFuture['type'] {
  return presentation;
}

/** Document implemented config shapes for architecture tests */
export type ImplementedPresentationConfigMap = {
  table: DatabaseTableConfig;
  board: DatabaseBoardConfig;
  calendar: DatabaseCalendarConfig;
  timeline: DatabaseTimelineConfig;
  gallery: DatabaseGalleryConfig;
};
