import { normalizeSavedViews } from './savedViews';
import type { SavedView } from './savedViewModels';

export const SAVED_VIEWS_KEY = 'note-saved-views-v1';

export function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    return normalizeSavedViews(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveSavedViews(views: readonly SavedView[]): void {
  try {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
  } catch {
    /** ignore quota errors */
  }
}
