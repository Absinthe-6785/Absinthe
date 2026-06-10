/**
 * Knowledge-9.75 / K-10 — Database presentation config types.
 */

import type { FormulaColumnDefinition } from '../formulas/formulaModels';
import type { RollupColumnDefinition } from '../rollups/rollupModels';
import type {
  DatabaseViewColumnEntry,
  DatabaseViewPresentation,
  DatabaseViewSort,
} from './databaseViewModels';

/** Ordered multi-column sort rule — K-18.1 */
export interface DatabaseViewSortRule {
  key: string;
  direction: DatabaseViewSort['direction'];
}

/** Table presentation config — mirrors K-9.5 columns + sort */
export interface DatabaseTableConfig {
  type: 'table';
  columns: DatabaseViewColumnEntry[];
  /** Legacy shorthand — kept in sync with sortRules[0] */
  sort: DatabaseViewSort;
  /** Multi-column sort priority list — K-18.1 */
  sortRules?: DatabaseViewSortRule[];
  /** Computed relation rollup columns — K-15 */
  rollupColumns?: RollupColumnDefinition[];
  /** Computed formula columns — K-16 */
  formulaColumns?: FormulaColumnDefinition[];
}

/** Board presentation config — K-10 */
export interface DatabaseBoardConfig {
  type: 'board';
  /** Property key used to assign notes to lanes, e.g. "status" */
  groupBy: string;
  /** Optional fixed lane order; when omitted, lanes derive from distinct property values */
  lanes?: string[];
  /** Property keys displayed on cards; defaults to title only */
  cardFields?: string[];
}

/** Calendar presentation config — K-11 */
export interface DatabaseCalendarConfig {
  type: 'calendar';
  /** Property key holding the event date, e.g. "dueDate"; use "updatedAt" for note metadata */
  dateProperty: string;
  /** Label for notes without a parseable date */
  unscheduledLabel?: string;
}

/** Timeline bar sort key — K-17.5 */
export type DatabaseTimelineSortBy = 'start' | 'end' | 'title';

/** Timeline presentation config — K-17.5 */
export interface DatabaseTimelineConfig {
  type: 'timeline';
  /** Property or metadata key for range start */
  startDateProperty: string;
  /** Optional range end — single-day when omitted or equal to start */
  endDateProperty?: string;
  sortBy?: DatabaseTimelineSortBy;
  unscheduledLabel?: string;
}

/** Gallery card size preset — K-17.75 */
export type DatabaseGalleryCardSize = 'compact' | 'medium' | 'large';

/** Gallery presentation config — K-17.75 */
export interface DatabaseGalleryConfig {
  type: 'gallery';
  /** Property key for cover image URL — optional */
  coverProperty?: string;
  /** Property keys on cards — same semantics as board cardFields */
  cardFields?: string[];
  cardSize?: DatabaseGalleryCardSize;
}

/** Discriminated presentation config — recommended K-10+ shape */
export type DatabasePresentationConfig =
  | DatabaseTableConfig
  | DatabaseBoardConfig
  | DatabaseCalendarConfig
  | DatabaseTimelineConfig
  | DatabaseGalleryConfig;

/** Recommended future DatabaseView core — query + presentation + config */
export interface DatabaseViewRecord {
  id: string;
  name: string;
  query: string;
  presentation: DatabaseViewPresentation;
  presentationConfig: DatabasePresentationConfig;
}

export function isDatabaseTableConfig(
  config: DatabasePresentationConfig,
): config is DatabaseTableConfig {
  return config.type === 'table';
}

export function isDatabaseBoardConfig(
  config: DatabasePresentationConfig,
): config is DatabaseBoardConfig {
  return config.type === 'board';
}

export function isDatabaseCalendarConfig(
  config: DatabasePresentationConfig,
): config is DatabaseCalendarConfig {
  return config.type === 'calendar';
}

export function isDatabaseTimelineConfig(
  config: DatabasePresentationConfig,
): config is DatabaseTimelineConfig {
  return config.type === 'timeline'
    && typeof config.startDateProperty === 'string'
    && config.startDateProperty.trim().length > 0;
}

export function isDatabaseGalleryConfig(
  config: DatabasePresentationConfig,
): config is DatabaseGalleryConfig {
  return config.type === 'gallery';
}

export function presentationConfigForType(
  presentation: DatabaseViewPresentation,
): DatabasePresentationConfig['type'] {
  return presentation;
}
