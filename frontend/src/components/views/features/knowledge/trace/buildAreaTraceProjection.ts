import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { getProperty } from '../properties/noteProperties';
import {
  buildBacklinkIndex,
  getIncomingLinks,
} from '../backlinks/buildBacklinkIndex';
import type { AreaTraceEventRef, AreaTraceProjection } from './areaTraceModels';
import { isAreaNote } from './areaNotes';
import { isEventNote, readEventFromNote } from './eventNotes';
import { isMilestoneNote, readMilestoneFromNote } from './milestoneNotes';
import { TRACE_PROPERTY_KEYS, type TraceMilestoneRef } from './dailyTraceModels';

function buildAreaMilestoneRef(note: NoteBase): TraceMilestoneRef | null {
  const milestone = readMilestoneFromNote(note);
  if (!milestone) return null;

  const label = milestone.milestoneLabel?.trim()
    || displayNoteTitle(note.title);
  const kind = getProperty(note, TRACE_PROPERTY_KEYS.MILESTONE_KIND)?.trim() ?? '';

  return {
    noteId: note.id,
    label,
    kind,
    date: milestone.milestoneDate,
  };
}

function buildAreaEventRef(note: NoteBase): AreaTraceEventRef | null {
  if (!isEventNote(note)) return null;

  const event = readEventFromNote(note);
  if (!event) return null;

  return {
    noteId: note.id,
    title: displayNoteTitle(event.title.trim() || note.title),
    date: event.eventDate,
    ...(event.eventTime ? { time: event.eventTime } : {}),
    ...(event.eventEndDate ? { endDate: event.eventEndDate } : {}),
  };
}

function collectTraceNotes(
  areaNote: NoteBase,
  linkedNotes: readonly NoteBase[],
): NoteBase[] {
  const byId = new Map<string, NoteBase>();
  byId.set(areaNote.id, areaNote);
  for (const note of linkedNotes) {
    byId.set(note.id, note);
  }
  return [...byId.values()];
}

export interface AreaMembership {
  areaNote: NoteBase;
  linkedNoteRecords: NoteBase[];
  memberNotes: NoteBase[];
}

export function resolveAreaMembership(
  areaNoteId: string,
  notes: readonly NoteBase[],
): AreaMembership {
  const activeNotes = notes.filter(note => note.deletedAt == null);
  const areaNote = activeNotes.find(note => note.id === areaNoteId);
  if (!areaNote) {
    throw new Error(`Area note not found: ${areaNoteId}`);
  }
  if (!isAreaNote(areaNote)) {
    throw new Error('Note is not marked as an area');
  }

  const notesById = new Map(activeNotes.map(note => [note.id, note]));
  const index = buildBacklinkIndex(activeNotes as NoteBase[]);
  const incoming = getIncomingLinks(index, areaNote.title ?? '', {
    excludeNoteId: areaNote.id,
  });

  const linkedNoteRecords = incoming
    .map(ref => notesById.get(ref.noteId))
    .filter((note): note is NoteBase => note != null);

  return {
    areaNote,
    linkedNoteRecords,
    memberNotes: collectTraceNotes(areaNote, linkedNoteRecords),
  };
}

/**
 * Reconstruct an area trace from backlink membership and K-28 property conventions.
 * Pure projection — no persistence, scoring, or interpretation.
 */
export function buildAreaTraceProjection(
  areaNoteId: string,
  notes: readonly NoteBase[],
): AreaTraceProjection {
  const { areaNote, linkedNoteRecords } = resolveAreaMembership(areaNoteId, notes);

  const linkedNotes = linkedNoteRecords
    .map(note => ({
      noteId: note.id,
      title: displayNoteTitle(note.title),
      updatedAt: note.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

  const traceNotes = collectTraceNotes(areaNote, linkedNoteRecords);

  const milestones = traceNotes
    .filter(isMilestoneNote)
    .map(buildAreaMilestoneRef)
    .filter((item): item is TraceMilestoneRef => item != null)
    .sort((a, b) =>
      b.date.localeCompare(a.date)
      || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    );

  const events = traceNotes
    .map(buildAreaEventRef)
    .filter((item): item is AreaTraceEventRef => item != null)
    .sort((a, b) =>
      b.date.localeCompare(a.date)
      || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    );

  return {
    areaNoteId: areaNote.id,
    areaTitle: displayNoteTitle(areaNote.title),
    linkedNotes,
    milestones,
    events,
  };
}

export function hasAreaTraceMarks(projection: AreaTraceProjection): boolean {
  return projection.linkedNotes.length > 0
    || projection.milestones.length > 0
    || projection.events.length > 0;
}

export function areaTraceMarkCount(projection: AreaTraceProjection): number {
  return projection.linkedNotes.length + projection.milestones.length + projection.events.length;
}
