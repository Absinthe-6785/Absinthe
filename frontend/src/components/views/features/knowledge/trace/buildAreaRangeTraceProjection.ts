import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { buildDailyTraceProjection } from './buildDailyTraceProjection';
import {
  buildRangeTraceProjection,
  enumerateDateKeys,
  formatRangeLensHeading,
  resolveRangeLensBounds,
} from './buildRangeTraceProjection';
import type { AreaRangeTraceProjection, AreaTraceLinkedNote } from './areaTraceModels';
import { resolveAreaMembership } from './buildAreaTraceProjection';
import type { TraceRangeLens } from './rangeTraceModels';

function buildLinkedNotesInRange(
  areaNoteId: string,
  memberNotes: readonly NoteBase[],
  range: ReturnType<typeof buildRangeTraceProjection>,
): AreaTraceLinkedNote[] {
  const markDates = new Map<string, string>();

  for (const dateKey of enumerateDateKeys(range.startDate, range.endDate)) {
    const daily = buildDailyTraceProjection(dateKey, memberNotes);
    for (const activity of daily.activities) {
      const previous = markDates.get(activity.noteId);
      if (!previous || dateKey > previous) {
        markDates.set(activity.noteId, dateKey);
      }
    }
  }

  for (const milestone of range.milestones) {
    const previous = markDates.get(milestone.noteId);
    if (!previous || milestone.date > previous) {
      markDates.set(milestone.noteId, milestone.date);
    }
  }

  for (const event of range.events) {
    const previous = markDates.get(event.noteId);
    if (!previous || event.date > previous) {
      markDates.set(event.noteId, event.date);
    }
  }

  const notesById = new Map(memberNotes.map(note => [note.id, note]));

  return [...markDates.entries()]
    .filter(([noteId]) => noteId !== areaNoteId)
    .map(([noteId, markDate]) => {
      const note = notesById.get(noteId);
      return {
        noteId,
        title: displayNoteTitle(note?.title),
        updatedAt: note?.updatedAt ?? 0,
        markDate,
      };
    })
    .sort((a, b) =>
      b.markDate.localeCompare(a.markDate)
      || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    )
    .map(({ noteId, title, updatedAt }) => ({ noteId, title, updatedAt }));
}

/**
 * Reconstruct an area trace scoped to a date range.
 * Membership remains backlink-only; time filters marks among member notes.
 */
export function buildAreaRangeTraceProjection(
  areaNoteId: string,
  startDate: string,
  endDate: string,
  notes: readonly NoteBase[],
): AreaRangeTraceProjection {
  const { areaNote, memberNotes } = resolveAreaMembership(areaNoteId, notes);
  const range = buildRangeTraceProjection(startDate, endDate, memberNotes);

  return {
    areaNoteId: areaNote.id,
    areaTitle: displayNoteTitle(areaNote.title),
    startDate: range.startDate,
    endDate: range.endDate,
    linkedNotes: buildLinkedNotesInRange(areaNote.id, memberNotes, range),
    milestones: range.milestones,
    events: range.events,
    notesTouched: range.notesTouched,
    notesCreated: range.notesCreated,
  };
}

export function buildAreaRangeLensProjection(
  areaNoteId: string,
  range: TraceRangeLens,
  notes: readonly NoteBase[],
): AreaRangeTraceProjection {
  const bounds = resolveRangeLensBounds(range);
  return buildAreaRangeTraceProjection(areaNoteId, bounds.startDate, bounds.endDate, notes);
}

export function formatAreaRangeHeading(areaTitle: string, range: TraceRangeLens): string {
  return `${areaTitle} · ${formatRangeLensHeading(range)}`;
}

export function hasAreaRangeTraceMarks(projection: AreaRangeTraceProjection): boolean {
  return projection.linkedNotes.length > 0
    || projection.milestones.length > 0
    || projection.events.length > 0
    || projection.notesTouched > 0;
}

export function areaRangeTraceMarkCount(projection: AreaRangeTraceProjection): number {
  return projection.linkedNotes.length
    + projection.milestones.length
    + projection.events.length;
}
