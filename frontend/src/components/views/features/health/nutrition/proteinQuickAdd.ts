import type { ProteinSource } from '@/types';

const RECENT_KEY = 'proteinRecentSources';
const USE_COUNT_KEY = 'proteinSourceUseCounts';

const SEED_NAMES = [
  'protein shake',
  'chicken breast',
  'eggs',
  'milk',
  'tuna',
  'greek yogurt',
] as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function recordProteinSourceUse(sourceId: string): void {
  const recent = readJson<string[]>(RECENT_KEY, []).filter(id => id !== sourceId);
  recent.unshift(sourceId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 12)));

  const counts = readJson<Record<string, number>>(USE_COUNT_KEY, {});
  counts[sourceId] = (counts[sourceId] ?? 0) + 1;
  localStorage.setItem(USE_COUNT_KEY, JSON.stringify(counts));
}

/** Rank sources for one-click Quick Add — recent, frequent, then name seeds. */
export function rankQuickAddSources(sources: readonly ProteinSource[], limit = 8): ProteinSource[] {
  if (sources.length === 0) return [];

  const recentIds = readJson<string[]>(RECENT_KEY, []);
  const counts = readJson<Record<string, number>>(USE_COUNT_KEY, {});
  const byId = new Map(sources.map(s => [s.id, s]));
  const picked: ProteinSource[] = [];
  const seen = new Set<string>();

  const push = (src: ProteinSource | undefined) => {
    if (!src || seen.has(src.id)) return;
    seen.add(src.id);
    picked.push(src);
  };

  for (const id of recentIds) push(byId.get(id));

  const byFrequency = [...sources].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
  for (const src of byFrequency) {
    if (picked.length >= limit) break;
    push(src);
  }

  for (const seed of SEED_NAMES) {
    if (picked.length >= limit) break;
    const match = sources.find(s => s.name.toLowerCase().includes(seed));
    push(match);
  }

  for (const src of sources) {
    if (picked.length >= limit) break;
    push(src);
  }

  return picked.slice(0, limit);
}

export function formatProteinLogTime(createdAt?: string): string {
  if (!createdAt) return '—';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}
