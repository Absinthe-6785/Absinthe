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

/** Table presentation config — mirrors K-9.5 columns + sort */
export interface DatabaseTableConfig {
  type: 'table';
  columns: DatabaseViewColumnEntry[];
  sort: DatabaseViewSort;
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

/** Discriminated presentation config — recommended K-10+ shape */
export type DatabasePresentationConfig =
  | DatabaseTableConfig
  | DatabaseBoardConfig
  | DatabaseCalendarConfig;

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

export function presentationConfigForType(
  presentation: DatabaseViewPresentation,
): DatabasePresentationConfig['type'] {
  return presentation;
}
