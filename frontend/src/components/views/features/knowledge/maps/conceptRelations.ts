import type { NoteBase } from '../../../noteUtils';
import { getRelationTargets, listRelationRecords } from '../relations/noteRelations';
import { normalizeRelationPropertyKey } from '../relations/relationNormalize';
import type { RelationRecord } from '../relations/relationModels';
import { isConceptNote } from '../research/noteClassification';

/** Lightweight concept relationship types — stored as relation property keys. */
export const CONCEPT_RELATION_TYPES = [
  'causes',
  'influences',
  'depends-on',
  'related-to',
  'contrasts-with',
] as const;

export type ConceptRelationType = typeof CONCEPT_RELATION_TYPES[number];

export const CONCEPT_RELATION_LABELS: Record<ConceptRelationType, string> = {
  'causes': 'causes',
  'influences': 'influences',
  'depends-on': 'depends on',
  'related-to': 'related to',
  'contrasts-with': 'contrasts with',
};

export const CONCEPT_RELATION_LABELS_KO: Record<ConceptRelationType, string> = {
  'causes': '원인',
  'influences': '영향',
  'depends-on': '의존',
  'related-to': '관련',
  'contrasts-with': '대조',
};

export function isConceptRelationType(key: string): key is ConceptRelationType {
  return CONCEPT_RELATION_TYPES.includes(key as ConceptRelationType);
}

export function normalizeConceptRelationType(key: string): ConceptRelationType | null {
  const norm = normalizeRelationPropertyKey(key);
  return CONCEPT_RELATION_TYPES.find(t => normalizeRelationPropertyKey(t) === norm) ?? null;
}

export function listConceptRelations(note: NoteBase): RelationRecord[] {
  return listRelationRecords(note).filter(r => isConceptRelationType(r.propertyKey));
}

export function getConceptRelationTargets(note: NoteBase, type: ConceptRelationType): string[] {
  return getRelationTargets(note, type);
}

export function countConceptRelationsByType(note: NoteBase): Record<ConceptRelationType, number> {
  const counts = Object.fromEntries(CONCEPT_RELATION_TYPES.map(t => [t, 0])) as Record<ConceptRelationType, number>;
  for (const rel of listConceptRelations(note)) {
    const type = normalizeConceptRelationType(rel.propertyKey);
    if (type) counts[type] += 1;
  }
  return counts;
}

export function filterConceptNotes(notes: readonly NoteBase[]): NoteBase[] {
  return notes.filter(n => !n.deletedAt && isConceptNote(n));
}
