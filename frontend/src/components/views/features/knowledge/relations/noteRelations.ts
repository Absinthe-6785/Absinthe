import type { NoteBase } from '../../../noteUtils';
import type { RelationRecord } from './relationModels';
import { normalizeNoteRelations, normalizeRelationPropertyKey } from './relationNormalize';

function relationMap(note: NoteBase): Record<string, string[]> {
  return note.relations ?? {};
}

function dedupe(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function listRelationKeys(note: NoteBase): string[] {
  return Object.keys(relationMap(note)).sort((a, b) => a.localeCompare(b));
}

export function getRelationTargets(note: NoteBase, propertyKey: string): string[] {
  const normKey = normalizeRelationPropertyKey(propertyKey);
  for (const [key, targetIds] of Object.entries(relationMap(note))) {
    if (normalizeRelationPropertyKey(key) === normKey) {
      return [...targetIds];
    }
  }
  return [];
}

export function setRelationTargets(
  note: NoteBase,
  propertyKey: string,
  targetIds: readonly string[],
): NoteBase {
  const trimmedKey = propertyKey.trim();
  if (!trimmedKey) return note;

  const normKey = normalizeRelationPropertyKey(trimmedKey);
  const next = { ...relationMap(note) };
  for (const key of Object.keys(next)) {
    if (normalizeRelationPropertyKey(key) === normKey) delete next[key];
  }

  const cleaned = dedupe(targetIds);
  if (cleaned.length > 0) {
    next[trimmedKey] = cleaned;
  }

  const relations = Object.keys(next).length > 0 ? next : undefined;
  return { ...note, relations };
}

export function addRelationTarget(
  note: NoteBase,
  propertyKey: string,
  targetId: string,
): NoteBase {
  const trimmedTarget = targetId.trim();
  if (!trimmedTarget) return note;
  const existing = getRelationTargets(note, propertyKey);
  if (existing.includes(trimmedTarget)) return note;
  return setRelationTargets(note, propertyKey, [...existing, trimmedTarget]);
}

export function removeRelationTarget(
  note: NoteBase,
  propertyKey: string,
  targetId: string,
): NoteBase {
  const trimmedTarget = targetId.trim();
  const existing = getRelationTargets(note, propertyKey).filter(id => id !== trimmedTarget);
  return setRelationTargets(note, propertyKey, existing);
}

export function listRelationRecords(note: NoteBase): RelationRecord[] {
  const records: RelationRecord[] = [];
  for (const [propertyKey, targetIds] of Object.entries(relationMap(note))) {
    for (const targetId of targetIds) {
      records.push({ propertyKey, targetId });
    }
  }
  return records;
}

export function hasRelations(note: NoteBase): boolean {
  return listRelationRecords(note).length > 0;
}
