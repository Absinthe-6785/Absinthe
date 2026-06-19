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

function pushToBucket(
  groups: RecentActivityGroup[],
  bucket: RecentActivityBucket,
  item: RecentActivityItem,
  limit: number,
): void {
  const group = groups.find(g => g.bucket === bucket);
  if (!group || group.items.length >= limit) return;
  if (group.items.some(x => x.domain === item.domain && x.id === item.id)) return;
  group.items.push(item);
}

export function buildRecentActivityProjection(
  input: RecentActivityProjectionInput,
): RecentActivityProjection {
  const now = input.now ?? new Date();
  const todayKey = toDateKey(now);
  const locale = input.locale;
  const limit = input.limitPerBucket ?? 6;
  const groups = emptyGroups();
  const labels = input.labels;

  const rel = (ts: number) => formatActivityTimestamp(ts, todayKey, locale, labels);

  for (const note of input.notes) {
    if (note.deletedAt) continue;
    const ts = Math.max(note.lastOpenedAt ?? 0, note.updatedAt ?? 0);
    if (!ts) continue;
    const bucket = classifyRecentActivityBucket(ts, todayKey);
    const kind = note.updatedAt && note.updatedAt >= (note.lastOpenedAt ?? 0) ? 'edited' : 'opened';
    pushToBucket(groups, bucket, {
      id: `notes:${note.id}:${kind}`,
      domain: 'notes',
      kind,
      title: displayNoteTitleForLocale(note.title, locale ?? undefined),
      timestamp: ts,
      relativeLabel: rel(ts),
      noteId: note.id,
    }, limit);
  }

  for (const entry of input.plannerRecents) {
    const bucket = classifyRecentActivityBucket(entry.at, todayKey);
    pushToBucket(groups, bucket, {
      id: `planner:${entry.kind}:${entry.itemId}`,
      domain: 'planner',
      kind: entry.kind,
      title: entry.title,
      timestamp: entry.at,
      relativeLabel: rel(entry.at),
      plannerItemId: entry.itemId,
    }, limit);
  }

  for (const entry of input.recipeRecents) {
    const bucket = classifyRecentActivityBucket(entry.at, todayKey);
    pushToBucket(groups, bucket, {
      id: `recipe:${entry.recipeId}`,
      domain: 'recipe',
      kind: 'viewed',
      title: entry.title?.trim() || entry.recipeId,
      timestamp: entry.at,
      relativeLabel: rel(entry.at),
      recipeId: entry.recipeId,
    }, limit);
  }

  for (const entry of input.archiveRestoreRecents) {
    const note = input.notes.find(n => n.id === entry.noteId);
    const title = note
      ? displayNoteTitleForLocale(note.title, locale ?? undefined)
      : entry.noteId;
    const bucket = classifyRecentActivityBucket(entry.restoredAt, todayKey);
    pushToBucket(groups, bucket, {
      id: `archive:restore:${entry.noteId}`,
      domain: 'archive',
      kind: 'restored',
      title,
      timestamp: entry.restoredAt,
      relativeLabel: rel(entry.restoredAt),
      noteId: entry.noteId,
    }, limit);
  }

  for (const group of groups) {
    group.items.sort((a, b) => b.timestamp - a.timestamp);
  }

  const isEmpty = groups.every(g => g.items.length === 0);
  return {
    groups,
    isEmpty,
    generatedAt: now.toISOString(),
  };
}

export function clearRecentActivityForTest(): void {
  /* composition only — storage cleared in domain modules */
}
