import type { NoteBase } from '../../../noteUtils';
import type {
  ArchiveTimelineEntry,
  ArchiveTimelineGroup,
  ArchiveTimelineProjection,
} from './archiveProjectionModels';
import { buildArchiveRecentMilestones } from './buildArchiveRecentMilestones';
import { buildArchiveMarkCalendarProjection } from './buildArchiveMarkCalendar';
import {
  ARCHIVE_TIMELINE_BUCKETS,
  classifyTimelineBucket,
  todayDateKey,
} from './archiveTimeBuckets';
import type { ArchiveDomainMarkDay } from './archiveHomeModels';

function emptyTimelineGroups(): Array<ArchiveTimelineGroup & { entries: ArchiveTimelineEntry[] }> {
  return ARCHIVE_TIMELINE_BUCKETS.map(bucket => ({ bucket, entries: [] }));
}

export function buildArchiveTimelineItems(
  notes: readonly NoteBase[],
  domainMarks: readonly ArchiveDomainMarkDay[],
  options?: {
    now?: Date;
    locale?: string;
    milestoneLimit?: number;
  },
): ArchiveTimelineProjection {
  const now = options?.now ?? new Date();
  const todayKey = todayDateKey(now);
  const locale = options?.locale;
  const groups = emptyTimelineGroups();

  const milestones = buildArchiveRecentMilestones(notes, {
    limit: options?.milestoneLimit ?? 40,
    now,
    locale,
  });

  for (const m of milestones) {
    const bucket = classifyTimelineBucket(m.date, todayKey);
    const group = groups.find(g => g.bucket === bucket);
    if (!group) continue;
    group.entries.push({
      id: `milestone-${m.noteId}`,
      label: m.displayLabel,
      dateKey: m.date,
      kind: 'milestone',
      noteId: m.noteId,
    });
  }

  const markCalendar = buildArchiveMarkCalendarProjection(notes, domainMarks, {
    now,
    calendarYears: 1,
    locale,
  });

  for (const day of markCalendar.days) {
    if (day.density <= 0) continue;
    const bucket = classifyTimelineBucket(day.date, todayKey);
    const group = groups.find(g => g.bucket === bucket);
    if (!group) continue;
    if (group.entries.some(e => e.id === `mark-${day.date}`)) continue;
    group.entries.push({
      id: `mark-${day.date}`,
      label: day.date,
      dateKey: day.date,
      kind: 'mark-day',
    });
  }

  for (const group of groups) {
    group.entries = group.entries
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
      .slice(0, 12);
  }

  const isEmpty = groups.every(g => g.entries.length === 0);

  return { groups, isEmpty };
}
