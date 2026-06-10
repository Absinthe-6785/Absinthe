import type { NoteBase } from '../../../noteUtils';
import { formatCalendarDayLabel, toDateKey } from './parseDatabaseDate';

/** Resolved timeline row — not persisted */
export interface TimelineItem {
  noteId: string;
  note: NoteBase;
  title: string;
  startDate: Date;
  endDate: Date;
}

export function formatTimelineDateRange(startDate: Date, endDate: Date): string {
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(endDate);
  if (startKey === endKey) {
    return formatCalendarDayLabel(startKey);
  }
  return `${formatCalendarDayLabel(startKey)} – ${formatCalendarDayLabel(endKey)}`;
}

export function timelineItemOverlapsMonth(
  item: TimelineItem,
  year: number,
  month: number,
): boolean {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  return item.startDate <= monthEnd && item.endDate >= monthStart;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
