import type { WorkspaceSearchRecentEntry } from '../knowledge/workspace/workspaceSearchRecent';
import { loadWorkspaceSearchRecent } from '../knowledge/workspace/workspaceSearchRecent';
import type { SearchRecentGroups, SearchRecentItem, SearchDomain } from './searchProjectionModels';

const MS_DAY = 86_400_000;
const STORAGE_KEY = 'absinthe-search-recent-v2';
const MAX_RECENT = 16;

export const SEARCH_RECENT_STORAGE_KEY = STORAGE_KEY;

export interface SearchRecentEntry {
  domain: SearchDomain;
  kind: string;
  id: string;
  title: string;
  accessedAt: number;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function relativeRecentLabel(at: number, now: Date): string {
  const diffMs = now.getTime() - at;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

export function loadSearchRecent(): SearchRecentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SearchRecentEntry[];
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENT);
    }
  } catch { /* fall through */ }
  return loadWorkspaceSearchRecent().map(e => ({
    domain: 'notes' as SearchDomain,
    kind: e.kind,
    id: e.id,
    title: e.title,
    accessedAt: e.accessedAt,
  }));
}

export function pushSearchRecent(entry: Omit<SearchRecentEntry, 'accessedAt'>): void {
  try {
    const prev = loadSearchRecent().filter(e => !(e.domain === entry.domain && e.id === entry.id));
    const next: SearchRecentEntry[] = [{ ...entry, accessedAt: Date.now() }, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function buildSearchRecentGroups(
  recent: readonly SearchRecentEntry[] | readonly WorkspaceSearchRecentEntry[],
  now: Date,
): SearchRecentGroups {
  const normalized: SearchRecentEntry[] = recent.map(e =>
    'domain' in e ? e as SearchRecentEntry : {
      domain: 'notes' as SearchDomain,
      kind: e.kind,
      id: e.id,
      title: e.title,
      accessedAt: e.accessedAt,
    },
  );

  const dayStart = startOfLocalDay(now);
  const today: SearchRecentItem[] = [];
  const earlier: SearchRecentItem[] = [];

  for (const entry of normalized) {
    const item: SearchRecentItem = {
      kind: entry.kind as SearchRecentItem['kind'],
      domain: entry.domain,
      id: entry.id,
      title: entry.title,
      accessedAt: entry.accessedAt,
      relativeLabel: relativeRecentLabel(entry.accessedAt, now),
    };
    if (entry.accessedAt >= dayStart) today.push(item);
    else earlier.push(item);
  }

  return { today, earlier };
}

export function clearSearchRecentHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('absinthe.workspaceSearch.recent');
  } catch { /* ignore */ }
}

export function clearSearchRecentForTest(): void {
  clearSearchRecentHistory();
}
