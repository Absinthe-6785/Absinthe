import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseFieldValue, getNoteDateValue } from './databaseFieldValues';
import { getTimelineConfig, withPresentationDefaults } from './databasePresentationConfig';
import type { DatabaseTimelineSortBy } from './databasePresentationModels';
import { filterByDatabaseView } from './filterByDatabaseView';
import type { TimelineItem } from './timelineModels';
import type { DatabaseView } from './databaseViewModels';

function sortTimelineItems(
  items: TimelineItem[],
  sortBy: DatabaseTimelineSortBy,
): TimelineItem[] {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'end': {
        const cmp = a.endDate.getTime() - b.endDate.getTime();
        return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
      }
      case 'title': {
        const cmp = a.title.localeCompare(b.title);
        return cmp !== 0 ? cmp : a.startDate.getTime() - b.startDate.getTime();
      }
      case 'start':
      default: {
        const cmp = a.startDate.getTime() - b.startDate.getTime();
        return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
      }
    }
  });
}

function resolveTimelineItem(
  note: NoteBase,
  startDateProperty: string,
  endDateProperty: string | undefined,
  service: KnowledgeIndexService,
): TimelineItem | null {
  const startDate = getNoteDateValue(note, startDateProperty, service);
  if (!startDate) return null;

  let endDate = startDate;
  if (endDateProperty?.trim()) {
    const parsedEnd = getNoteDateValue(note, endDateProperty, service);
    if (parsedEnd) {
      endDate = parsedEnd;
    }
  }

  if (endDate.getTime() < startDate.getTime()) {
    endDate = startDate;
  }

  return {
    noteId: note.id,
    note,
    title: getDatabaseFieldValue(note, 'title', service),
    startDate,
    endDate,
  };
}

/**
 * Full database view timeline pipeline: filter via query engine, then resolve date ranges.
 * Query semantics are unchanged — timeline bucketing is post-filter only.
 */
export function prepareDatabaseTimelineItems(
  view: DatabaseView,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): TimelineItem[] {
  const configured = withPresentationDefaults(view);
  const timelineConfig = getTimelineConfig(configured);
  const filtered = filterByDatabaseView(
    notes.filter(note => !note.deletedAt),
    service,
    configured,
  ).notes;

  const items: TimelineItem[] = [];
  for (const note of filtered) {
    const item = resolveTimelineItem(
      note,
      timelineConfig.startDateProperty,
      timelineConfig.endDateProperty,
      service,
    );
    if (item) {
      items.push(item);
    }
  }

  return sortTimelineItems(items, timelineConfig.sortBy ?? 'start');
}

export type { TimelineItem };
