import type { NoteBase } from '../../../noteUtils';
import { isEventNote, readEventFromNote } from '../../knowledge/trace/eventNotes';
import { isMilestoneNote, readMilestoneFromNote } from '../../knowledge/trace/milestoneNotes';
import type {
  PlannerEventCatalog,
  PlannerEventDefinition,
  PlannerEventOccurrence,
  PlannerEventSpanPosition,
  PlannerMilestoneRow,
} from './calendarModels';
import { enumerateClippedDateKeys, isDateInRange } from './plannerCalendarDateUtils';

function resolveSpanPosition(
  dateKey: string,
  startDate: string,
  endDate: string,
): PlannerEventSpanPosition {
  if (startDate === endDate) return 'single';
  if (dateKey === startDate) return 'start';
  if (dateKey === endDate) return 'end';
  return 'middle';
}

export function buildPlannerEventCatalog(notes: readonly NoteBase[]): PlannerEventCatalog {
  const definitions: PlannerEventDefinition[] = [];
  const byNoteId = new Map<string, PlannerEventDefinition>();

  for (const note of notes) {
    if (note.deletedAt != null || !isEventNote(note)) continue;

    const parsed = readEventFromNote(note);
    if (!parsed?.eventDate) continue;

    const startDate = parsed.eventDate;
    const endDate = parsed.eventEndDate ?? parsed.eventDate;
    const startTime = parsed.eventTime?.trim() || undefined;
    const endTime = parsed.eventEndTime?.trim() || undefined;

    const definition: PlannerEventDefinition = {
      noteId: note.id,
      title: parsed.title.trim() || 'Untitled',
      startDate,
      endDate,
      startTime,
      endTime,
      isAllDay: !startTime,
    };

    definitions.push(definition);
    byNoteId.set(note.id, definition);
  }

  definitions.sort((a, b) => {
    const dateCmp = a.startDate.localeCompare(b.startDate);
    if (dateCmp !== 0) return dateCmp;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });

  return { definitions, byNoteId };
}

export function expandEventOccurrences(
  catalog: PlannerEventCatalog,
  range: { startDate: string; endDate: string },
): PlannerEventOccurrence[] {
  const occurrences: PlannerEventOccurrence[] = [];

  for (const definition of catalog.definitions) {
    const dateKeys = enumerateClippedDateKeys(
      definition.startDate,
      definition.endDate,
      range.startDate,
      range.endDate,
    );

    for (const dateKey of dateKeys) {
      const spanPosition = resolveSpanPosition(dateKey, definition.startDate, definition.endDate);
      const isStartDay = dateKey === definition.startDate;
      const isEndDay = dateKey === definition.endDate;

      occurrences.push({
        occurrenceId: `${definition.noteId}:${dateKey}`,
        noteId: definition.noteId,
        title: definition.title,
        dateKey,
        spanPosition,
        isAllDay: definition.isAllDay || !isStartDay,
        startTime: isStartDay ? definition.startTime : undefined,
        endTime: isEndDay ? definition.endTime : undefined,
        definition,
      });
    }
  }

  occurrences.sort((a, b) => {
    const dateCmp = a.dateKey.localeCompare(b.dateKey);
    if (dateCmp !== 0) return dateCmp;
    const aTime = a.startTime ?? '00:00';
    const bTime = b.startTime ?? '00:00';
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });

  return occurrences;
}

export function buildPlannerMilestoneRows(
  notes: readonly NoteBase[],
  range: { startDate: string; endDate: string },
): PlannerMilestoneRow[] {
  const rows: PlannerMilestoneRow[] = [];

  for (const note of notes) {
    if (note.deletedAt != null || !isMilestoneNote(note)) continue;

    const milestone = readMilestoneFromNote(note);
    if (!milestone?.milestoneDate) continue;
    if (!isDateInRange(milestone.milestoneDate, range.startDate, range.endDate)) continue;

    const label = milestone.milestoneLabel?.trim()
      || note.title.trim()
      || 'Untitled';

    rows.push({
      noteId: note.id,
      title: note.title.trim() || 'Untitled',
      dateKey: milestone.milestoneDate,
      label,
    });
  }

  rows.sort((a, b) => {
    const dateCmp = a.dateKey.localeCompare(b.dateKey);
    if (dateCmp !== 0) return dateCmp;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });

  return rows;
}
