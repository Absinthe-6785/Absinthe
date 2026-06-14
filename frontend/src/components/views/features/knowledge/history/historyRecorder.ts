import type { NoteBase } from '../../../noteUtils';
import { extractLinks, normalizeWikiTitle } from '../../../noteUtils';
import { getProperty } from '../properties/noteProperties';
import { isAreaNote } from '../trace/areaNotes';
import type { KnowledgeHistoryEvent, KnowledgeHistoryEventType } from './eventTypes';
import { appendKnowledgeHistoryEvent } from './historyStorage';

function newEventId(type: KnowledgeHistoryEventType, noteId: string): string {
  return `${type.toLowerCase()}-${noteId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function record(type: KnowledgeHistoryEventType, partial: Omit<KnowledgeHistoryEvent, 'id' | 'type' | 'timestamp'> & { timestamp?: number }): void {
  appendKnowledgeHistoryEvent({
    id: newEventId(type, partial.noteId),
    type,
    timestamp: partial.timestamp ?? Date.now(),
    noteId: partial.noteId,
    relatedNoteId: partial.relatedNoteId,
    areaId: partial.areaId,
    metadata: partial.metadata,
  });
}

export function recordNoteCreated(noteId: string, metadata?: Record<string, string>): void {
  record('NOTE_CREATED', { noteId, metadata });
}

export function recordNoteDeleted(noteId: string, metadata?: Record<string, string>): void {
  record('NOTE_DELETED', { noteId, metadata });
}

export function recordLinkCreated(
  noteId: string,
  linkTitle: string,
  relatedNoteId?: string,
): void {
  record('LINK_CREATED', {
    noteId,
    relatedNoteId,
    metadata: { linkTitle },
  });
}

export function recordLinkRemoved(noteId: string, linkTitle: string): void {
  record('LINK_REMOVED', {
    noteId,
    metadata: { linkTitle },
  });
}

export function recordAreaAssigned(noteId: string, areaLabel: string): void {
  record('AREA_ASSIGNED', {
    noteId,
    areaId: areaLabel,
    metadata: { areaLabel },
  });
}

export function recordAreaRemoved(noteId: string, areaLabel: string): void {
  record('AREA_REMOVED', {
    noteId,
    areaId: areaLabel,
    metadata: { areaLabel },
  });
}

export function recordHubCreated(noteId: string, areaLabel: string): void {
  record('HUB_CREATED', {
    noteId,
    areaId: areaLabel,
    metadata: { areaLabel },
  });
}

export function recordDiscoveryResolved(
  noteId: string,
  metadata?: Record<string, string>,
  relatedNoteId?: string,
): void {
  record('DISCOVERY_RESOLVED', {
    noteId,
    relatedNoteId,
    metadata,
  });
}

function linkKeys(body: string): Set<string> {
  return new Set(extractLinks(body).map(normalizeWikiTitle).filter(Boolean));
}

export function recordLinkChanges(noteId: string, beforeBody: string, afterBody: string): void {
  const before = linkKeys(beforeBody);
  const after = linkKeys(afterBody);
  for (const link of after) {
    if (!before.has(link)) recordLinkCreated(noteId, link);
  }
  for (const link of before) {
    if (!after.has(link)) recordLinkRemoved(noteId, link);
  }
}

function areaLabel(note: NoteBase): string | undefined {
  const value = getProperty(note, 'area')?.trim();
  return value || undefined;
}

export function recordPropertyChanges(before: NoteBase, after: NoteBase): void {
  const prevArea = areaLabel(before);
  const nextArea = areaLabel(after);

  if (prevArea !== nextArea) {
    if (nextArea) recordAreaAssigned(after.id, nextArea);
    if (prevArea && !nextArea) recordAreaRemoved(after.id, prevArea);
  }

  if (!isAreaNote(before) && isAreaNote(after)) {
    recordHubCreated(after.id, nextArea ?? ((after.title ?? '').trim() || 'hub'));
  }
}

export function recordNoteUpdateDiff(before: NoteBase, after: NoteBase): void {
  if (before.body !== after.body) {
    recordLinkChanges(before.id, before.body, after.body);
  }
  recordPropertyChanges(before, after);
}
