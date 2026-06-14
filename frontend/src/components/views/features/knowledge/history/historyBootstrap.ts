import type { NoteBase } from '../../../noteUtils';
import { extractLinks } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getProperty } from '../properties/noteProperties';
import { isAreaNote } from '../trace/areaNotes';
import { noteEffectiveCreatedAt } from '../timeline/timelineMetrics';
import type { KnowledgeHistoryEvent } from './eventTypes';
import {
  loadKnowledgeHistoryEvents,
  saveKnowledgeHistoryEvents,
} from './historyStorage';

export const HISTORY_BOOTSTRAP_STORAGE_KEY = 'absinthe:knowledge-history-bootstrap:v1';
export const IMPORTED_METADATA_KEY = 'imported';
export const IMPORTED_METADATA_VALUE = 'true';

function hasLocalStorage(): boolean {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis;
}

export function isHistoryBootstrapComplete(): boolean {
  if (!hasLocalStorage()) return false;
  try {
    return globalThis.localStorage.getItem(HISTORY_BOOTSTRAP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHistoryBootstrapComplete(): void {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.setItem(HISTORY_BOOTSTRAP_STORAGE_KEY, '1');
  } catch {
    // Ignore.
  }
}

export function hasNonImportedHistory(
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): boolean {
  return events.some(e => e.metadata?.[IMPORTED_METADATA_KEY] !== IMPORTED_METADATA_VALUE);
}

function importedEvent(
  id: string,
  type: KnowledgeHistoryEvent['type'],
  noteId: string,
  timestamp: number,
  extras: Partial<KnowledgeHistoryEvent> = {},
): KnowledgeHistoryEvent {
  return {
    id,
    type,
    timestamp,
    noteId,
    ...extras,
    metadata: {
      ...extras.metadata,
      [IMPORTED_METADATA_KEY]: IMPORTED_METADATA_VALUE,
      source: 'bootstrap',
    },
  };
}

/** One-time seed from note metadata — idempotent via deterministic event ids. */
export function bootstrapKnowledgeHistory(
  notes: readonly NoteBase[],
  _service?: KnowledgeIndexService,
): number {
  if (isHistoryBootstrapComplete()) return 0;

  const existing = loadKnowledgeHistoryEvents();
  if (hasNonImportedHistory(existing)) {
    markHistoryBootstrapComplete();
    return 0;
  }

  const existingIds = new Set(existing.map(e => e.id));
  const seeded: KnowledgeHistoryEvent[] = [];
  const active = notes.filter(n => !n.deletedAt);

  for (const note of active) {
    const createdAt = noteEffectiveCreatedAt(note);
    const noteEventId = `bootstrap-note-${note.id}`;
    if (!existingIds.has(noteEventId)) {
      seeded.push(importedEvent(noteEventId, 'NOTE_CREATED', note.id, createdAt, {
        metadata: { title: (note.title ?? '').trim() },
      }));
    }

    for (const link of extractLinks(note.body ?? '')) {
      const linkKey = link.toLowerCase().replace(/\s+/g, '-');
      const linkEventId = `bootstrap-link-${note.id}-${linkKey}`;
      if (existingIds.has(linkEventId)) continue;
      seeded.push(importedEvent(linkEventId, 'LINK_CREATED', note.id, createdAt, {
        metadata: { linkTitle: link },
      }));
    }

    const area = getProperty(note, 'area')?.trim();
    if (area) {
      const areaEventId = `bootstrap-area-${note.id}`;
      if (!existingIds.has(areaEventId)) {
        seeded.push(importedEvent(areaEventId, 'AREA_ASSIGNED', note.id, createdAt, {
          areaId: area,
          metadata: { areaLabel: area },
        }));
      }
    }

    if (isAreaNote(note)) {
      const hubEventId = `bootstrap-hub-${note.id}`;
      if (!existingIds.has(hubEventId)) {
        seeded.push(importedEvent(hubEventId, 'HUB_CREATED', note.id, createdAt, {
          areaId: area ?? (note.title ?? '').trim(),
          metadata: { areaLabel: area ?? (note.title ?? '').trim() },
        }));
      }
    }
  }

  if (seeded.length === 0 && active.length === 0) {
    markHistoryBootstrapComplete();
    return 0;
  }

  const merged = [...existing, ...seeded].sort((a, b) => a.timestamp - b.timestamp);
  saveKnowledgeHistoryEvents(merged);
  markHistoryBootstrapComplete();
  return seeded.length;
}

export function maybeBootstrapKnowledgeHistory(
  notes: readonly NoteBase[],
  service?: KnowledgeIndexService,
): number {
  if (isHistoryBootstrapComplete()) return 0;
  if (loadKnowledgeHistoryEvents().length > 0 && hasNonImportedHistory()) {
    markHistoryBootstrapComplete();
    return 0;
  }
  return bootstrapKnowledgeHistory(notes, service);
}
