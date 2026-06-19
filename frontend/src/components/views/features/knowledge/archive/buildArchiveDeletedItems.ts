import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitleForLocale } from '../../../noteDisplayTitle';
import { formatActivityTimestamp } from '../../../k102DateFormat';
import type { ArchiveDeletedProjection } from './archiveProjectionModels';
import { todayDateKey } from './archiveTimeBuckets';

export function buildArchiveDeletedItems(
  notes: readonly NoteBase[],
  options?: { now?: Date; locale?: string; limit?: number },
): ArchiveDeletedProjection {
  const now = options?.now ?? new Date();
  const todayKey = todayDateKey(now);
  const locale = options?.locale;
  const limit = options?.limit ?? 100;

  const trashed = notes
    .filter(n => n.deletedAt != null)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    .slice(0, limit)
    .map(n => ({
      noteId: n.id,
      title: displayNoteTitleForLocale(n.title, locale),
      deletedAt: n.deletedAt ?? 0,
      relativeLabel: formatActivityTimestamp(
        n.deletedAt ?? 0,
        todayKey,
        null,
        { today: 'Today', yesterday: 'Yesterday', daysAgo: count => `${count} days ago` },
      ),
    }));

  return {
    items: trashed,
    totalCount: notes.filter(n => n.deletedAt != null).length,
    isEmpty: trashed.length === 0,
  };
}
