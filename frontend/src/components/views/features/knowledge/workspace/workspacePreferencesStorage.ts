import {
  DEFAULT_WORKSPACE_PREFERENCES,
  normalizeWorkspacePreferences,
  type WorkspacePreferences,
} from './workspacePreferences';

export const WORKSPACE_PREFS_KEY = 'workspace-prefs-v1';

export function loadWorkspacePreferences(): WorkspacePreferences {
  try {
    const raw = localStorage.getItem(WORKSPACE_PREFS_KEY);
    if (!raw) return { ...DEFAULT_WORKSPACE_PREFERENCES };
    return normalizeWorkspacePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WORKSPACE_PREFERENCES };
  }
}

export function saveWorkspacePreferences(prefs: WorkspacePreferences): void {
  try {
    localStorage.setItem(WORKSPACE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /** ignore quota errors */
  }
}

export function clearWorkspacePreferences(): void {
  try {
    localStorage.removeItem(WORKSPACE_PREFS_KEY);
  } catch {
    /** ignore storage errors */
  }
}
