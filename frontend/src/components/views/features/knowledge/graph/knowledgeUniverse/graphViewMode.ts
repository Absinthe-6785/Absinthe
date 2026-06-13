export type GraphViewMode = 'network' | 'universe';

const STORAGE_KEY = 'absinthe-graph-view-mode';

export function loadGraphViewMode(): GraphViewMode {
  if (typeof window === 'undefined') return 'network';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'universe' ? 'universe' : 'network';
  } catch {
    return 'network';
  }
}

export function saveGraphViewMode(mode: GraphViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}

export function isUniverseMode(mode: GraphViewMode): boolean {
  return mode === 'universe';
}
