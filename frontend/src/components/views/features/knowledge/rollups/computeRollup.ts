import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseFieldValue } from '../databaseViews/databaseFieldValues';
import { normalizeRelationPropertyKey } from '../relations/relationNormalize';
import type { RollupDefinition, RollupValue } from './rollupModels';

export interface LinkedNoteRef {
  id: string;
  missing: boolean;
}

function formatUpdatedAt(timestamp: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function parseNumeric(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Resolve linked note ids for a rollup — uses KIS relation indexes only */
export function resolveRollupLinkedNotes(
  noteId: string,
  definition: RollupDefinition,
  service: KnowledgeIndexService,
): LinkedNoteRef[] {
  const direction = definition.direction ?? 'incoming';
  const normKey = normalizeRelationPropertyKey(definition.relationKey);

  if (direction === 'outgoing') {
    return service.resolveRelationTargets(noteId, definition.relationKey).map(target => ({
      id: target.targetId,
      missing: target.missing,
    }));
  }

  return service.getIncomingRelations(noteId)
    .filter(edge => normalizeRelationPropertyKey(edge.propertyKey) === normKey)
    .map(edge => ({
      id: edge.sourceId,
      missing: !service.getNoteTitle(edge.sourceId),
    }));
}

function readLinkedFieldValue(
  linkedId: string,
  field: string,
  service: KnowledgeIndexService,
  notesById: ReadonlyMap<string, NoteBase>,
): string {
  const note = notesById.get(linkedId);
  if (note) {
    return getDatabaseFieldValue(note, field, service);
  }
  if (field === 'title') {
    return service.getNoteTitle(linkedId);
  }
  return service.getProperties(linkedId)[field] ?? '';
}

function readLinkedUpdatedAt(
  linkedId: string,
  notesById: ReadonlyMap<string, NoteBase>,
): number {
  return notesById.get(linkedId)?.updatedAt ?? 0;
}

function readLinkedTitle(
  linkedId: string,
  service: KnowledgeIndexService,
  notesById: ReadonlyMap<string, NoteBase>,
): string {
  const note = notesById.get(linkedId);
  if (note?.title?.trim()) return note.title.trim();
  return service.getNoteTitle(linkedId) || 'Missing target';
}

function sortLinkedNotes(
  linked: LinkedNoteRef[],
  definition: RollupDefinition,
  service: KnowledgeIndexService,
  notesById: ReadonlyMap<string, NoteBase>,
): LinkedNoteRef[] {
  const sortBy = definition.sortBy ?? (definition.function === 'latest' ? 'updatedAt' : 'title');
  const includeMissing = definition.includeMissing === true;

  const entries = linked.filter(item => includeMissing || !item.missing);
  return [...entries].sort((a, b) => {
    if (sortBy === 'updatedAt') {
      return readLinkedUpdatedAt(a.id, notesById) - readLinkedUpdatedAt(b.id, notesById);
    }
    if (sortBy === 'title') {
      return readLinkedTitle(a.id, service, notesById)
        .localeCompare(readLinkedTitle(b.id, service, notesById));
    }
    const aValue = readLinkedFieldValue(a.id, sortBy, service, notesById);
    const bValue = readLinkedFieldValue(b.id, sortBy, service, notesById);
    return aValue.localeCompare(bValue);
  });
}

/** Compute a single rollup value for a row note — not persisted */
export function computeRollup(
  note: NoteBase,
  definition: RollupDefinition,
  service: KnowledgeIndexService,
  notesById: ReadonlyMap<string, NoteBase> = new Map(),
): RollupValue {
  const linked = resolveRollupLinkedNotes(note.id, definition, service);
  const missingTargets = linked.filter(item => item.missing).length;
  const includeMissing = definition.includeMissing === true;
  const active = linked.filter(item => includeMissing || !item.missing);

  switch (definition.function) {
    case 'count':
      return {
        raw: active.length,
        display: String(active.length),
        missingTargets: missingTargets || undefined,
      };

    case 'list': {
      const titles = active.map(item =>
        readLinkedTitle(item.id, service, notesById),
      );
      return {
        raw: titles,
        display: titles.length > 0 ? titles.join(', ') : '—',
        missingTargets: missingTargets || undefined,
      };
    }

    case 'sum': {
      const field = definition.targetField?.trim();
      if (!field) {
        return { raw: null, display: '—', missingTargets: missingTargets || undefined };
      }
      let total = 0;
      let seen = 0;
      for (const item of active) {
        const raw = readLinkedFieldValue(item.id, field, service, notesById);
        const parsed = parseNumeric(raw);
        if (parsed === null) continue;
        total += parsed;
        seen += 1;
      }
      return {
        raw: seen > 0 ? total : null,
        display: seen > 0 ? String(total) : '—',
        missingTargets: missingTargets || undefined,
      };
    }

    case 'latest': {
      const field = definition.targetField?.trim() || 'updatedAt';
      const sorted = sortLinkedNotes(linked, {
        ...definition,
        sortBy: field === 'updatedAt' ? 'updatedAt' : field,
      }, service, notesById);
      const last = sorted.at(-1);
      if (!last || (!includeMissing && last.missing)) {
        return { raw: null, display: '—', missingTargets: missingTargets || undefined };
      }
      if (field === 'updatedAt') {
        const timestamp = readLinkedUpdatedAt(last.id, notesById);
        const display = formatUpdatedAt(timestamp) || '—';
        return {
          raw: timestamp || null,
          display,
          missingTargets: missingTargets || undefined,
        };
      }
      const value = readLinkedFieldValue(last.id, field, service, notesById);
      return {
        raw: value || null,
        display: value || '—',
        missingTargets: missingTargets || undefined,
      };
    }

    case 'first': {
      const sorted = sortLinkedNotes(linked, definition, service, notesById);
      const first = sorted[0];
      if (!first || (!includeMissing && first.missing)) {
        return { raw: null, display: '—', missingTargets: missingTargets || undefined };
      }
      const sortBy = definition.sortBy ?? 'title';
      if (sortBy === 'updatedAt') {
        const timestamp = readLinkedUpdatedAt(first.id, notesById);
        return {
          raw: timestamp || null,
          display: formatUpdatedAt(timestamp) || '—',
          missingTargets: missingTargets || undefined,
        };
      }
      if (sortBy === 'title') {
        const title = readLinkedTitle(first.id, service, notesById);
        return {
          raw: title,
          display: title || '—',
          missingTargets: missingTargets || undefined,
        };
      }
      const value = readLinkedFieldValue(first.id, sortBy, service, notesById);
      return {
        raw: value || null,
        display: value || '—',
        missingTargets: missingTargets || undefined,
      };
    }

    case 'last': {
      const sorted = sortLinkedNotes(linked, definition, service, notesById);
      const last = sorted.at(-1);
      if (!last || (!includeMissing && last.missing)) {
        return { raw: null, display: '—', missingTargets: missingTargets || undefined };
      }
      const sortBy = definition.sortBy ?? 'title';
      if (sortBy === 'updatedAt') {
        const timestamp = readLinkedUpdatedAt(last.id, notesById);
        return {
          raw: timestamp || null,
          display: formatUpdatedAt(timestamp) || '—',
          missingTargets: missingTargets || undefined,
        };
      }
      if (sortBy === 'title') {
        const title = readLinkedTitle(last.id, service, notesById);
        return {
          raw: title,
          display: title || '—',
          missingTargets: missingTargets || undefined,
        };
      }
      const value = readLinkedFieldValue(last.id, sortBy, service, notesById);
      return {
        raw: value || null,
        display: value || '—',
        missingTargets: missingTargets || undefined,
      };
    }

    default:
      return { raw: null, display: '—' };
  }
}