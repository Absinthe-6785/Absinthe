import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { Language, TranslationKey } from '../../../../../lib/i18n';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { IMPORTED_METADATA_KEY, IMPORTED_METADATA_VALUE } from './historyBootstrap';

export interface HistoryEventDayGroup {
  dateKey: string;
  label: string;
  events: KnowledgeHistoryEvent[];
}

export interface HistoryEventPresentation {
  event: KnowledgeHistoryEvent;
  actionKey: TranslationKey;
  detail: string;
  noteId: string;
  relatedNoteId?: string;
  imported: boolean;
}

function noteTitle(notes: readonly NoteBase[], noteId: string): string {
  const note = notes.find(n => n.id === noteId);
  return note ? displayNoteTitle(note.title) : noteId;
}

function formatDateLabel(timestamp: number, lang: Language): string {
  return new Date(timestamp).toLocaleDateString(
    lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : undefined,
    { month: 'short', day: 'numeric' },
  );
}

export function isImportedEvent(event: KnowledgeHistoryEvent): boolean {
  return event.metadata?.[IMPORTED_METADATA_KEY] === IMPORTED_METADATA_VALUE;
}

export function presentHistoryEvent(
  event: KnowledgeHistoryEvent,
  notes: readonly NoteBase[],
): HistoryEventPresentation {
  const imported = isImportedEvent(event);
  const title = event.metadata?.title ?? noteTitle(notes, event.noteId);
  const linkTitle = event.metadata?.linkTitle;
  const areaLabel = event.areaId ?? event.metadata?.areaLabel;
  const action = event.metadata?.action;

  switch (event.type) {
    case 'NOTE_CREATED':
      return { event, actionKey: 'k45EventNoteCreated', detail: title, noteId: event.noteId, imported };
    case 'NOTE_DELETED':
      return { event, actionKey: 'k45EventNoteDeleted', detail: title, noteId: event.noteId, imported };
    case 'LINK_CREATED': {
      const target = linkTitle ?? (event.relatedNoteId ? noteTitle(notes, event.relatedNoteId) : '');
      const detail = target ? `${title} ↔ ${target}` : title;
      return {
        event,
        actionKey: 'k45EventLinkCreated',
        detail,
        noteId: event.noteId,
        relatedNoteId: event.relatedNoteId,
        imported,
      };
    }
    case 'LINK_REMOVED':
      return {
        event,
        actionKey: 'k45EventLinkRemoved',
        detail: linkTitle ? `${title} ↔ ${linkTitle}` : title,
        noteId: event.noteId,
        imported,
      };
    case 'AREA_ASSIGNED':
      return {
        event,
        actionKey: 'k45EventAreaAssigned',
        detail: areaLabel ? `${title} · ${areaLabel}` : title,
        noteId: event.noteId,
        imported,
      };
    case 'AREA_REMOVED':
      return {
        event,
        actionKey: 'k45EventAreaRemoved',
        detail: areaLabel ?? title,
        noteId: event.noteId,
        imported,
      };
    case 'HUB_CREATED':
      return {
        event,
        actionKey: 'k45EventHubCreated',
        detail: areaLabel ?? title,
        noteId: event.noteId,
        imported,
      };
    case 'DISCOVERY_RESOLVED': {
      const actionKey = action === 'create-hub'
        ? 'k45EventDiscoveryHub'
        : action === 'assign-area'
          ? 'k45EventDiscoveryArea'
          : action === 'connect' || action === 'create-relation'
            ? 'k45EventDiscoveryLink'
            : 'k45EventDiscoveryResolved';
      return {
        event,
        actionKey,
        detail: title,
        noteId: event.noteId,
        relatedNoteId: event.relatedNoteId,
        imported,
      };
    }
    default:
      return { event, actionKey: 'k45EventNoteCreated', detail: title, noteId: event.noteId, imported };
  }
}

export function groupEventsByDate(
  events: readonly KnowledgeHistoryEvent[],
  lang: Language,
): HistoryEventDayGroup[] {
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
  const groups = new Map<string, HistoryEventDayGroup>();

  for (const event of sorted) {
    const date = new Date(event.timestamp);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const label = formatDateLabel(event.timestamp, lang);
    const group = groups.get(dateKey) ?? { dateKey, label, events: [] };
    group.events.push(event);
    groups.set(dateKey, group);
  }

  return [...groups.values()];
}
