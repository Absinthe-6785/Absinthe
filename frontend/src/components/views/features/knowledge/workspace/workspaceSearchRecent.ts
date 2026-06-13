import type { WorkspaceSearchResultKind } from './buildWorkspaceSearch';

export interface WorkspaceSearchRecentEntry {
  kind: WorkspaceSearchResultKind;
  id: string;
  title: string;
  accessedAt: number;
}

const STORAGE_KEY = 'absinthe.workspaceSearch.recent';
const MAX_RECENT = 8;

export function loadWorkspaceSearchRecent(): WorkspaceSearchRecentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkspaceSearchRecentEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function pushWorkspaceSearchRecent(entry: Omit<WorkspaceSearchRecentEntry, 'accessedAt'>): void {
  try {
    const prev = loadWorkspaceSearchRecent().filter(
      e => !(e.kind === entry.kind && e.id === entry.id),
    );
    const next: WorkspaceSearchRecentEntry[] = [
      { ...entry, accessedAt: Date.now() },
      ...prev,
    ].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

export function recentEntryKey(kind: WorkspaceSearchResultKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseRecentEntryKey(key: string): { kind: WorkspaceSearchResultKind; id: string } | null {
  const idx = key.indexOf(':');
  if (idx <= 0) return null;
  return {
    kind: key.slice(0, idx) as WorkspaceSearchResultKind,
    id: key.slice(idx + 1),
  };
}
