/**
 * Knowledge-8.75 — Lightweight workspace infrastructure types.
 *
 * Documentation-first shared model for Saved Views, Smart Collections,
 * Rule Collections, and future Database Views. Existing entity modules
 * retain their own types; these types describe the recommended unified
 * activation and filter dispatch layer for K-9+.
 */

import type { SmartCollectionId } from '../collections/smartCollectionModels';

/** Workspace entity categories — distinct product roles, shared infrastructure */
export type WorkspaceItemKind =
  | 'saved-view'
  | 'smart-collection'
  | 'rule-collection'
  | 'database-view';

/** How a workspace selection resolves to a note ID set */
export type WorkspaceFilterSource =
  | 'search-query'        // saved view → bound to search input
  | 'index-evaluator'     // smart collection → KnowledgeIndexService helpers
  | 'query-rule'          // rule collection / database view → filterNotes
  | 'none';

/** Single active workspace selection — replaces multiple nullable IDs in NoteView */
export type WorkspaceActivation =
  | { kind: 'none' }
  | { kind: 'saved-view'; id: string }
  | { kind: 'smart-collection'; id: SmartCollectionId }
  | { kind: 'rule-collection'; id: string }
  | { kind: 'database-view'; id: string };

/** Minimal sidebar identity — presentation layer only */
export interface WorkspaceItemRef {
  id: string;
  kind: WorkspaceItemKind;
  name: string;
  /** Tooltip / subtitle — query string, description, or view type */
  subtitle?: string;
  /** Vault-wide result count when applicable */
  count?: number;
}

/** Maps workspace kind to its filter resolution strategy */
export const WORKSPACE_FILTER_SOURCE: Record<WorkspaceItemKind, WorkspaceFilterSource> = {
  'saved-view': 'search-query',
  'smart-collection': 'index-evaluator',
  'rule-collection': 'query-rule',
  'database-view': 'query-rule',
};

/** Default inactive workspace state */
export const INACTIVE_WORKSPACE: WorkspaceActivation = { kind: 'none' };

/** Whether two activations refer to the same workspace selection */
export function isSameWorkspaceActivation(
  a: WorkspaceActivation,
  b: WorkspaceActivation,
): boolean {
  if (a.kind === 'none' && b.kind === 'none') return true;
  if (a.kind === 'none' || b.kind === 'none') return false;
  return a.kind === b.kind && a.id === b.id;
}

export type { DatabaseView, DatabaseViewPresentation } from '../databaseViews/databaseViewModels';
