/**
 * K-113 — Cross-domain recent activity composition layer (not a sixth domain projection).
 */
import type { Language } from '../../lib/i18n';
import type { NoteBase } from './noteUtils';
import { displayNoteTitleForLocale } from './noteDisplayTitle';
import {
  classifyRecentActivityBucket,
  formatActivityTimestamp,
  type RecentActivityBucket,
} from './k102DateFormat';
import type { RelativeDateLabels } from './k102DateFormat';
import { toDateKey } from './features/knowledge/databaseViews/parseDatabaseDate';
import type { ArchiveRestoreRecentEntry } from './features/knowledge/archive/archiveProjectionModels';
import type { RecipeActivityEntry } from './features/recipe/recipeActivityStorage';
import type { PlannerActivityEntry } from './features/planner/plannerActivityStorage';
import { validPlannerEventDate } from './features/planner/plannerActivityStorage';

export type RecentActivityDomain = 'notes' | 'planner' | 'recipe' | 'archive';

export const RECENT_ACTIVITY_BUCKETS: readonly RecentActivityBucket[] = [
  'today',
  'yesterday',
  'earlier',
];

export const RECENT_ACTIVITY_DOMAINS: readonly RecentActivityDomain[] = [
  'notes',
  'planner',
  'recipe',
  'archive',
];

export interface RecentActivityItem {
  id: string;
  domain: RecentActivityDomain;
  kind: string;
  title: string;
  timestamp: number;
  relativeLabel: string;
  noteId?: string;
  plannerItemId?: string;
  eventDate?: string;
  recipeId?: string;
}

export interface RecentActivityGroup {
  bucket: RecentActivityBucket;
  items: RecentActivityItem[];
}

export interface RecentActivityProjection {
  groups: RecentActivityGroup[];
  isEmpty: boolean;
  generatedAt: string;
}

export interface RecentActivityProjectionInput {
  notes: readonly NoteBase[];
  plannerRecents: readonly PlannerActivityEntry[];
  recipeRecents: readonly RecipeActivityEntry[];
  archiveRestoreRecents: readonly ArchiveRestoreRecentEntry[];
  labels: RelativeDateLabels;
  locale?: Language | null;
  now?: Date;
  limitPerBucket?: number;
}

function emptyGroups(): RecentActivityGroup[] {
  return RECENT_ACTIVITY_BUCKETS.map(bucket => ({ bucket, items: [] }));
}

type RecentActivitySeen = Map<RecentActivityBucket, Map<RecentActivityDomain, Set<string>>>;

function pushToBucket(
  groups: RecentActivityGroup[],
  seen: RecentActivitySeen,
  bucket: RecentActivityBucket,
  domain: RecentActivityDomain,
  id: string,
  createItem: () => RecentActivityItem,
): void {
  const group = groups.find(g => g.bucket === bucket);
  if (!group) return;

  let bucketSeen = seen.get(bucket);
  if (!bucketSeen) {
    bucketSeen = new Map();
    seen.set(bucket, bucketSeen);
  }
  let domainSeen = bucketSeen.get(domain);
  if (!domainSeen) {
    domainSeen = new Set();
    bucketSeen.set(domain, domainSeen);
  }
  if (domainSeen.has(id)) return;
  domainSeen.add(id);
  group.items.push(createItem());
}

export function buildRecentActivityGroups(
  input: Omit<RecentActivityProjectionInput, 'now'>,
  todayKey: string,
): RecentActivityGroup[] {
  const locale = input.locale;
  const limit = Math.max(0, input.limitPerBucket ?? 6);
  const groups = emptyGroups();
  const seen: RecentActivitySeen = new Map();
  const labels = input.labels;

  const rel = (ts: number) => formatActivityTimestamp(ts, todayKey, locale, labels);

  for (const note of input.notes) {
    if (note.deletedAt) continue;
    const ts = Math.max(note.lastOpenedAt ?? 0, note.updatedAt ?? 0);
    if (!ts) continue;
    const bucket = classifyRecentActivityBucket(ts, todayKey);
    const kind = note.updatedAt && note.updatedAt >= (note.lastOpenedAt ?? 0) ? 'edited' : 'opened';
    const id = `notes:${note.id}:${kind}`;
    pushToBucket(groups, seen, bucket, 'notes', id, () => ({
      id,
      domain: 'notes',
      kind,
      title: displayNoteTitleForLocale(note.title, locale ?? undefined),
      timestamp: ts,
      relativeLabel: rel(ts),
      noteId: note.id,
    }));
  }

  for (const entry of input.plannerRecents) {
    const bucket = classifyRecentActivityBucket(entry.at, todayKey);
    const eventDate = entry.kind === 'schedule' ? validPlannerEventDate(entry.eventDate) : undefined;
    const id = `planner:${entry.kind}:${entry.itemId}`;
    pushToBucket(groups, seen, bucket, 'planner', id, () => ({
      id,
      domain: 'planner',
      kind: entry.kind,
      title: entry.title,
      timestamp: entry.at,
      relativeLabel: rel(entry.at),
      plannerItemId: entry.itemId,
      ...(eventDate ? { eventDate } : {}),
    }));
  }

  for (const entry of input.recipeRecents) {
    const bucket = classifyRecentActivityBucket(entry.at, todayKey);
    const id = `recipe:${entry.recipeId}`;
    pushToBucket(groups, seen, bucket, 'recipe', id, () => ({
      id,
      domain: 'recipe',
      kind: 'viewed',
      title: entry.title?.trim() || entry.recipeId,
      timestamp: entry.at,
      relativeLabel: rel(entry.at),
      recipeId: entry.recipeId,
    }));
  }

  for (const entry of input.archiveRestoreRecents) {
    const bucket = classifyRecentActivityBucket(entry.restoredAt, todayKey);
    const id = `archive:restore:${entry.noteId}`;
    pushToBucket(groups, seen, bucket, 'archive', id, () => {
      const note = input.notes.find(n => n.id === entry.noteId);
      return {
        id,
        domain: 'archive',
        kind: 'restored',
        title: note ? displayNoteTitleForLocale(note.title, locale ?? undefined) : entry.noteId,
        timestamp: entry.restoredAt,
        relativeLabel: rel(entry.restoredAt),
        noteId: entry.noteId,
      };
    });
  }

  for (const group of groups) {
    group.items = group.items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => b.item.timestamp - a.item.timestamp || a.index - b.index)
      .slice(0, limit)
      .map(({ item }) => item);
  }

  return groups;
}

export function stampRecentActivityProjection(groups: RecentActivityGroup[], now: Date): RecentActivityProjection {
  return {
    groups,
    isEmpty: groups.every(g => g.items.length === 0),
    generatedAt: now.toISOString(),
  };
}

export function buildRecentActivityProjection(input: RecentActivityProjectionInput): RecentActivityProjection {
  const now = input.now ?? new Date();
  return stampRecentActivityProjection(buildRecentActivityGroups(input, toDateKey(now)), now);
}

export function clearRecentActivityForTest(): void {
  /* composition only — storage cleared in domain modules */
}
