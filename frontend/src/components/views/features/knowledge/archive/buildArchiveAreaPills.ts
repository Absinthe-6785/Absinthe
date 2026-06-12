import type { NoteBase } from '../../../noteUtils';
import { listAreaNotes } from '../trace/areaNotes';
import { resolveAreaMembership } from '../trace/buildAreaTraceProjection';
import type { ArchiveAreaPill } from './archiveHomeModels';
import { archiveCalendarBounds, isDateInRange } from './archiveMarkUtils';
import { collectNoteMarkDatesInWindow } from './buildNoteMarkIndex';

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildArchiveAreaPills(
  notes: readonly NoteBase[],
  options: { now: Date; lookbackMonths?: number; limit?: number },
): ArchiveAreaPill[] {
  const lookbackMonths = options.lookbackMonths ?? 24;
  const limit = options.limit ?? 8;
  const lookbackStart = toLocalDateKey(subtractMonths(options.now, lookbackMonths));
  const endDate = toLocalDateKey(options.now);

  const pills: ArchiveAreaPill[] = [];

  for (const areaNote of listAreaNotes(notes)) {
    const membership = resolveAreaMembership(areaNote.id, notes);
    const markDates = new Set<string>();

    for (const member of membership.memberNotes) {
      for (const dateKey of collectNoteMarkDatesInWindow(member, lookbackStart, endDate)) {
        markDates.add(dateKey);
      }
    }

    if (markDates.size === 0) continue;

    const sortedDates = [...markDates].sort();
    const lastMarkDate = sortedDates[sortedDates.length - 1] ?? null;
    const title = areaNote.title.trim() || 'Untitled';

    pills.push({
      areaNoteId: areaNote.id,
      title,
      markCount: markDates.size,
      lastMarkDate,
      areaRef: {
        areaNoteId: areaNote.id,
        title,
      },
    });
  }

  pills.sort((a, b) => {
    if (a.lastMarkDate && b.lastMarkDate && a.lastMarkDate !== b.lastMarkDate) {
      return b.lastMarkDate.localeCompare(a.lastMarkDate);
    }
    if (a.lastMarkDate && !b.lastMarkDate) return -1;
    if (!a.lastMarkDate && b.lastMarkDate) return 1;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });

  return pills.slice(0, limit);
}

/** Lookback window clipped to calendar bounds — for tests / future optimization */
export function resolveAreaLookbackWindow(
  now: Date,
  lookbackMonths: number,
  calendarYears: number,
): { lookbackStart: string; endDate: string } {
  const endDate = toLocalDateKey(now);
  const lookbackStart = toLocalDateKey(subtractMonths(now, lookbackMonths));
  const { startDate: calendarStart } = archiveCalendarBounds(now, calendarYears);
  return {
    lookbackStart: lookbackStart > calendarStart ? lookbackStart : calendarStart,
    endDate,
  };
}

export function isAreaLookbackDate(dateKey: string, lookbackStart: string, endDate: string): boolean {
  return isDateInRange(dateKey, lookbackStart, endDate);
}
