import type { WorkspaceSearchRecentEntry } from '../knowledge/workspace/workspaceSearchRecent';
import { loadWorkspaceSearchRecent } from '../knowledge/workspace/workspaceSearchRecent';
import type { SearchRecentGroups, SearchRecentItem, SearchDomain } from './searchProjectionModels';

const MS_DAY = 86_400_000;
const STORAGE_KEY = 'absinthe-search-recent-v2';
const RECIPE_STORAGE_KEY_PREFIX = `${STORAGE_KEY}:recipe:`;
const MAX_RECENT = 16;

export const SEARCH_RECENT_STORAGE_KEY = STORAGE_KEY;
export const SEARCH_RECIPE_RECENT_STORAGE_KEY_PREFIX = RECIPE_STORAGE_KEY_PREFIX;

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

function accountScopedRecipeKey(accountId?: string): string | null {
  const normalized = accountId?.trim();
  return normalized ? `${RECIPE_STORAGE_KEY_PREFIX}${encodeURIComponent(normalized)}` : null;
}

function readStoredEntries(key: string): SearchRecentEntry[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SearchRecentEntry[];
    if (Array.isArray(parsed)) return parsed.filter(entry => (
      entry && typeof entry.domain === 'string' && typeof entry.kind === 'string'
      && typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.accessedAt === 'number'
    )).slice(0, MAX_RECENT);
  } catch { /* fall through */ }
  return null;
}

function readGlobalEntries(): SearchRecentEntry[] {
  const stored = readStoredEntries(STORAGE_KEY);
  if (stored) return stored.filter(entry => entry.domain !== 'recipe');
  return loadWorkspaceSearchRecent().map(e => ({
    domain: 'notes' as SearchDomain,
    kind: e.kind,
    id: e.id,
    title: e.title,
    accessedAt: e.accessedAt,
  }));
}

export function loadSearchRecent(accountId?: string): SearchRecentEntry[] {
  const accountKey = accountScopedRecipeKey(accountId);
  const recipeEntries = accountKey ? (readStoredEntries(accountKey) ?? []) : [];
  return [...readGlobalEntries(), ...recipeEntries]
    .sort((a, b) => b.accessedAt - a.accessedAt)
    .slice(0, MAX_RECENT);
}

export function pushSearchRecent(entry: Omit<SearchRecentEntry, 'accessedAt'>, accountId?: string): void {
  const key = entry.domain === 'recipe' ? accountScopedRecipeKey(accountId) : STORAGE_KEY;
  if (!key) return;
  try {
    const prev = (entry.domain === 'recipe'
      ? (readStoredEntries(key) ?? [])
      : readGlobalEntries()
    ).filter(e => !(e.domain === entry.domain && e.id === entry.id));
    const next: SearchRecentEntry[] = [{ ...entry, accessedAt: Date.now() }, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(key, JSON.stringify(next));
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

export function clearSearchRecentHistory(accountId?: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('absinthe.workspaceSearch.recent');
    const key = accountScopedRecipeKey(accountId);
    if (key) localStorage.removeItem(key);
  } catch { /* ignore */ }
}

export function clearSearchRecentForTest(): void {
  clearSearchRecentHistory();
  try {
    const keysToRemove: string[] = [];
    const length = typeof localStorage.length === 'number' ? localStorage.length : 0;
    for (let index = 0; index < length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(RECIPE_STORAGE_KEY_PREFIX)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch { /* ignore */ }
}
