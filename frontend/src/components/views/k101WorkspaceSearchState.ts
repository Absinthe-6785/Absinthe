import type { WorkspaceSearchFilter } from './features/knowledge/workspace/buildWorkspaceSearch';

export const WORKSPACE_SEARCH_STATE_KEY = 'absinthe-workspace-search-state';

export interface WorkspaceSearchPersistedState {
  query: string;
  filter: WorkspaceSearchFilter;
}

let memoryFallback: WorkspaceSearchPersistedState | null = null;

export function readWorkspaceSearchState(): WorkspaceSearchPersistedState {
  try {
    const raw = sessionStorage.getItem(WORKSPACE_SEARCH_STATE_KEY);
    if (!raw) return memoryFallback ?? { query: '', filter: 'all' };
    const parsed = JSON.parse(raw) as Partial<WorkspaceSearchPersistedState>;
    return {
      query: typeof parsed.query === 'string' ? parsed.query : '',
      filter: parsed.filter ?? 'all',
    };
  } catch {
    return memoryFallback ?? { query: '', filter: 'all' };
  }
}

export function writeWorkspaceSearchState(state: WorkspaceSearchPersistedState): void {
  memoryFallback = state;
  try {
    sessionStorage.setItem(WORKSPACE_SEARCH_STATE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

/** Test helper — reset in-memory fallback. */
export function resetWorkspaceSearchStateForTests(): void {
  memoryFallback = null;
  try {
    sessionStorage.removeItem(WORKSPACE_SEARCH_STATE_KEY);
  } catch { /* ignore */ }
}
