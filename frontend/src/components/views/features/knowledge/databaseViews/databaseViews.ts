import { isKnowledgeQuery, parseQuery } from '../query/parseQuery';
import type { DatabaseView, DatabaseViewPresentation } from './databaseViewModels';

const SUPPORTED_PRESENTATIONS: readonly DatabaseViewPresentation[] = ['table'];

export function isValidDatabaseViewQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed || !isKnowledgeQuery(trimmed)) return false;
  return !parseQuery(trimmed).error;
}

function isSupportedPresentation(value: unknown): value is DatabaseViewPresentation {
  return typeof value === 'string' && SUPPORTED_PRESENTATIONS.includes(value as DatabaseViewPresentation);
}

export function normalizeDatabaseViews(raw: unknown): DatabaseView[] {
  if (!Array.isArray(raw)) return [];

  const views: DatabaseView[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Partial<DatabaseView>;
    if (typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.query !== 'string') {
      continue;
    }
    const name = record.name.trim();
    const query = record.query.trim();
    const presentation = isSupportedPresentation(record.presentation) ? record.presentation : 'table';
    if (!record.id || !name || !query || !isValidDatabaseViewQuery(query)) continue;
    views.push({ id: record.id, name, query, presentation });
  }

  return views.sort((a, b) => a.name.localeCompare(b.name));
}

export function findDatabaseView(
  views: readonly DatabaseView[],
  id: string,
): DatabaseView | undefined {
  return views.find(view => view.id === id);
}

export function createDatabaseView(
  views: readonly DatabaseView[],
  name: string,
  query: string,
  id = `database-${Date.now()}`,
): DatabaseView[] {
  const trimmedName = name.trim();
  const trimmedQuery = query.trim();
  if (!trimmedName || !isValidDatabaseViewQuery(trimmedQuery)) return [...views];

  const next: DatabaseView = {
    id,
    name: trimmedName,
    query: trimmedQuery,
    presentation: 'table',
  };
  return [...views, next].sort((a, b) => a.name.localeCompare(b.name));
}

export function renameDatabaseView(
  views: readonly DatabaseView[],
  id: string,
  name: string,
): DatabaseView[] {
  const trimmedName = name.trim();
  if (!trimmedName) return [...views];

  return views
    .map(view => (view.id === id ? { ...view, name: trimmedName } : view))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function deleteDatabaseView(
  views: readonly DatabaseView[],
  id: string,
): DatabaseView[] {
  return views.filter(view => view.id !== id);
}

/** Activate a database view — returns workspace activation payload */
export function activateDatabaseView(view: DatabaseView): { kind: 'database-view'; id: string } {
  return { kind: 'database-view', id: view.id };
}
