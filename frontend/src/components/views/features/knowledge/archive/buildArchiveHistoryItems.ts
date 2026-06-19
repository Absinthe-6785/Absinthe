import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitleForLocale } from '../../../noteDisplayTitle';
import type { RelativeDateLabels } from '../../../k102DateFormat';
import { formatActivityTimestamp } from '../../../k102DateFormat';
import type {
  ArchiveHistoryGroup,
  ArchiveHistoryItem,
  ArchiveHistoryProjection,
  ArchiveRestoreRecentEntry,
} from './archiveProjectionModels';
import {
  ARCHIVE_HISTORY_BUCKETS,
  classifyHistoryBucket,
  todayDateKey,
} from './archiveTimeBuckets';

function emptyGroups(): ArchiveHistoryGroup[] {
  return ARCHIVE_HISTORY_BUCKETS.map(bucket => ({
    bucket,
    opened: [],
    edited: [],
    restored: [],
  }));
}

function pushItem(
  groups: ArchiveHistoryGroup[],
  item: ArchiveHistoryItem,
): void {
  const group = groups.find(g => g.bucket === item.bucket);
  if (!group) return;
  const list = item.kind === 'opened' ? group.opened
    : item.kind === 'edited' ? group.edited
      : group.restored;
  if (list.some(x => x.noteId === item.noteId && x.kind === item.kind)) return;
  list.push(item);
}

export function buildArchiveHistoryItems(
  notes: readonly NoteBase[],
  restoreRecents: readonly ArchiveRestoreRecentEntry[],
  options?: { now?: Date; locale?: string; limitPerKind?: number; dateLabels?: RelativeDateLabels },
): ArchiveHistoryProjection {
  const now = options?.now ?? new Date();
  const todayKey = todayDateKey(now);
  const locale = options?.locale;
  const limit = options?.limitPerKind ?? 8;
  const dateLabels = options?.dateLabels ?? {
    today: 'Today',
    yesterday: 'Yesterday',
    daysAgo: (n: number) => `${n} days ago`,
  };
  const groups = emptyGroups();
  const byId = new Map(notes.map(n => [n.id, n]));

  const active = notes.filter(n => !n.deletedAt);

  for (const note of active) {
    if (note.lastOpenedAt) {
      const bucket = classifyHistoryBucket(note.lastOpenedAt, todayKey);
      pushItem(groups, {
        noteId: note.id,
        title: displayNoteTitleForLocale(note.title, locale),
        timestamp: note.lastOpenedAt,
        kind: 'opened',
        bucket,
        relativeLabel: formatActivityTimestamp(
          note.lastOpenedAt,
          todayKey,
          null,
          dateLabels,
        ),
      });
    }
    if (note.updatedAt) {
      const bucket = classifyHistoryBucket(note.updatedAt, todayKey);
      pushItem(groups, {
        noteId: note.id,
        title: displayNoteTitleForLocale(note.title, locale),
        timestamp: note.updatedAt,
        kind: 'edited',
        bucket,
        relativeLabel: formatActivityTimestamp(
          note.updatedAt,
          todayKey,
          null,
          dateLabels,
        ),
      });
    }
  }

  for (const recent of restoreRecents) {
    const note = byId.get(recent.noteId);
    if (!note || note.deletedAt) continue;
    const bucket = classifyHistoryBucket(recent.restoredAt, todayKey);
    pushItem(groups, {
      noteId: recent.noteId,
      title: displayNoteTitleForLocale(note.title, locale),
      timestamp: recent.restoredAt,
      kind: 'restored',
      bucket,
      relativeLabel: formatActivityTimestamp(
        recent.restoredAt,
        todayKey,
        null,
        dateLabels,
      ),
    });
  }

  for (const group of groups) {
    group.opened.sort((a, b) => b.timestamp - a.timestamp).splice(limit);
    group.edited.sort((a, b) => b.timestamp - a.timestamp).splice(limit);
    group.restored.sort((a, b) => b.timestamp - a.timestamp).splice(limit);
  }

  const isEmpty = groups.every(
    g => g.opened.length === 0 && g.edited.length === 0 && g.restored.length === 0,
  );

  return { groups, isEmpty };
}

export function sortArchiveDeletedItems<T extends { deletedAt: number; title: string }>(
  items: readonly T[],
  sort: 'newest' | 'oldest' | 'title',
): T[] {
  const copy = [...items];
  if (sort === 'newest') copy.sort((a, b) => b.deletedAt - a.deletedAt);
  else if (sort === 'oldest') copy.sort((a, b) => a.deletedAt - b.deletedAt);
  else copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  return copy;
}

export function filterArchiveDeletedItems<T extends { title: string }>(
  items: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter(item => item.title.toLowerCase().includes(q));
}
