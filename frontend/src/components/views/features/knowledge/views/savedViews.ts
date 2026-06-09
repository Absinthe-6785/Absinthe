import { isKnowledgeQuery, parseQuery } from '../query/parseQuery';
import type { SavedView } from './savedViewModels';

export function isValidSavedViewQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed || !isKnowledgeQuery(trimmed)) return false;
  return !parseQuery(trimmed).error;
}

export function normalizeSavedViews(raw: unknown): SavedView[] {
  if (!Array.isArray(raw)) return [];

  const views: SavedView[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Partial<SavedView>;
    if (typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.query !== 'string') {
      continue;
    }
    const name = record.name.trim();
    const query = record.query.trim();
    if (!record.id || !name || !query || !isValidSavedViewQuery(query)) continue;
    views.push({ id: record.id, name, query });
  }

  return views.sort((a, b) => a.name.localeCompare(b.name));
}

export function findSavedView(views: readonly SavedView[], id: string): SavedView | undefined {
  return views.find(view => view.id === id);
}

export function createSavedView(
  views: readonly SavedView[],
  name: string,
  query: string,
  id = `view-${Date.now()}`,
): SavedView[] {
  const trimmedName = name.trim();
  const trimmedQuery = query.trim();
  if (!trimmedName || !isValidSavedViewQuery(trimmedQuery)) return [...views];

  const next: SavedView = { id, name: trimmedName, query: trimmedQuery };
  return [...views, next].sort((a, b) => a.name.localeCompare(b.name));
}

export function renameSavedView(
  views: readonly SavedView[],
  id: string,
  name: string,
): SavedView[] {
  const trimmedName = name.trim();
  if (!trimmedName) return [...views];

  return views
    .map(view => (view.id === id ? { ...view, name: trimmedName } : view))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function deleteSavedView(
  views: readonly SavedView[],
  id: string,
): SavedView[] {
  return views.filter(view => view.id !== id);
}

/** Apply a saved view — returns query string for the search input */
export function activateSavedView(view: SavedView): string {
  return view.query;
}
