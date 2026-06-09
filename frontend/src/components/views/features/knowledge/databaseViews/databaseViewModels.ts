/** Phase 1 presentation modes — table only implemented in K-9 */
export type DatabaseViewPresentation = 'table' | 'board' | 'calendar';

/** User-defined database view — stores query rule, not note ids */
export interface DatabaseView {
  id: string;
  name: string;
  query: string;
  presentation: DatabaseViewPresentation;
}

/** Lightweight table column definition */
export interface DatabaseColumn {
  id: string;
  key: string;
  label: string;
}
