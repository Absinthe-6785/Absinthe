import { normalizeDatabaseViews } from './databaseViews';
import type { DatabaseView } from './databaseViewModels';

export const DATABASE_VIEWS_KEY = 'note-database-views-v1';

export function loadDatabaseViews(): DatabaseView[] {
  try {
    const raw = localStorage.getItem(DATABASE_VIEWS_KEY);
    if (!raw) return [];
    return normalizeDatabaseViews(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveDatabaseViews(views: readonly DatabaseView[]): void {
  try {
    localStorage.setItem(DATABASE_VIEWS_KEY, JSON.stringify(views));
  } catch {
    /** ignore quota errors */
  }
}
