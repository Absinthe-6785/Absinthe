/**
 * Knowledge-8.75 — Lightweight workspace infrastructure types.
 *
 * Documentation-first shared model for Saved Views, Smart Collections,
 * Rule Collections, and future Database Views. Existing entity modules
 * retain their own types; these types describe the recommended unified
 * activation and filter dispatch layer for K-9+.
 */

import type { SmartCollectionId } from '../collections/smartCollectionModels';
import { isSmartCollectionId } from '../collections/smartCollections';

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
  | { kind: 'dashboard' }
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

/** Alias for sidebar/dashboard references (K-19.1) */
export type WorkspaceRef = WorkspaceItemRef;

/** Persisted workspace session slice — foundation for K-19.2 restore */
export interface WorkspaceSessionState {
  activation: WorkspaceActivation;
  updatedAt: number;
  /** Last non-dashboard activation for resume widget (K-19.3) */
  resumeActivation?: WorkspaceActivation;
}

const WORKSPACE_ITEM_KINDS: readonly WorkspaceItemKind[] = [
  'saved-view',
  'smart-collection',
  'rule-collection',
  'database-view',
];

export function isWorkspaceItemKind(value: unknown): value is WorkspaceItemKind {
  return typeof value === 'string'
    && WORKSPACE_ITEM_KINDS.includes(value as WorkspaceItemKind);
}

export function isWorkspaceActivation(value: unknown): value is WorkspaceActivation {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<WorkspaceActivation>;
  if (record.kind === 'none' || record.kind === 'dashboard') return true;
  if (typeof record.kind !== 'string' || typeof record.id !== 'string') return false;
  if (!isWorkspaceItemKind(record.kind)) return false;
  const id = record.id.trim();
  if (!id) return false;
  if (record.kind === 'smart-collection' && !isSmartCollectionId(id)) return false;
  return true;
}

export function isActiveWorkspaceActivation(
  activation: WorkspaceActivation,
): activation is Exclude<WorkspaceActivation, { kind: 'none' }> {
  return activation.kind !== 'none';
}

export function normalizeWorkspaceActivation(raw: unknown): WorkspaceActivation {
  if (!isWorkspaceActivation(raw)) return INACTIVE_WORKSPACE;
  if (raw.kind === 'none') return INACTIVE_WORKSPACE;
  if (raw.kind === 'dashboard') return { kind: 'dashboard' };
  if (raw.kind === 'smart-collection') {
    return { kind: 'smart-collection', id: raw.id.trim() as SmartCollectionId };
  }
  return { kind: raw.kind, id: raw.id.trim() };
}

export function normalizeWorkspaceSession(raw: unknown): WorkspaceSessionState | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<WorkspaceSessionState>;
  const activation = normalizeWorkspaceActivation(record.activation);
  const updatedAt = typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
    ? record.updatedAt
    : Date.now();
  const resumeActivation = record.resumeActivation
    ? normalizeWorkspaceActivation(record.resumeActivation)
    : undefined;
  const session: WorkspaceSessionState = { activation, updatedAt };
  if (
    resumeActivation
    && resumeActivation.kind !== 'none'
    && resumeActivation.kind !== 'dashboard'
  ) {
    session.resumeActivation = resumeActivation;
  }
  return session;
}

/** Whether two activations refer to the same workspace selection */
export function isSameWorkspaceActivation(
  a: WorkspaceActivation,
  b: WorkspaceActivation,
): boolean {
  if (a.kind === 'none' && b.kind === 'none') return true;
  if (a.kind === 'none' || b.kind === 'none') return false;
  if (a.kind === 'dashboard' && b.kind === 'dashboard') return true;
  if (a.kind === 'dashboard' || b.kind === 'dashboard') return false;
  return a.kind === b.kind && a.id === b.id;
}

export type { DatabaseView, DatabaseViewPresentation } from '../databaseViews/databaseViewModels';
