import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { NoteReferenceSummary } from '../references/extractNoteReferenceSummary';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { isConceptNote } from '../research/noteClassification';
import {
  CONCEPT_RELATION_TYPES,
  countConceptRelationsByType,
  listConceptRelations,
  type ConceptRelationType,
} from './conceptRelations';

export interface ConceptHubEntry {
  noteId: string;
  noteTitle: string;
  relationType: ConceptRelationType;
  direction: 'outgoing' | 'incoming';
}

export interface ConceptHubData {
  centralTitle: string;
  isConcept: boolean;
  relatedConcepts: ConceptHubEntry[];
  relationCounts: Record<ConceptRelationType, number>;
  backlinkCount: number;
  outgoingLinkCount: number;
  incomingRelationCount: number;
}

export interface BuildConceptHubInput {
  note: NoteBase;
  notes: readonly NoteBase[];
  service: KnowledgeIndexService;
  referenceSummary?: NoteReferenceSummary | null;
}

export function buildConceptHub(input: BuildConceptHubInput): ConceptHubData {
  const { note, notes, service, referenceSummary } = input;
  const relationCounts = countConceptRelationsByType(note);
  const relatedConcepts: ConceptHubEntry[] = [];

  for (const rel of listConceptRelations(note)) {
    const type = rel.propertyKey as ConceptRelationType;
    if (!CONCEPT_RELATION_TYPES.includes(type)) continue;
    const target = notes.find(n => n.id === rel.targetId);
    if (target && !target.deletedAt) {
      relatedConcepts.push({
        noteId: rel.targetId,
        noteTitle: displayNoteTitle(target.title),
        relationType: type,
        direction: 'outgoing',
      });
    }
  }

  for (const edge of service.getIncomingRelations(note.id)) {
    const type = edge.propertyKey as ConceptRelationType;
    if (!CONCEPT_RELATION_TYPES.includes(type)) continue;
    const source = notes.find(n => n.id === edge.sourceId);
    if (source && !source.deletedAt) {
      relatedConcepts.push({
        noteId: edge.sourceId,
        noteTitle: displayNoteTitle(source.title),
        relationType: type,
        direction: 'incoming',
      });
    }
  }

  for (const ref of referenceSummary?.outgoing ?? []) {
    const target = ref.targetNoteId ? notes.find(n => n.id === ref.targetNoteId) : undefined;
    if (target && isConceptNote(target) && !relatedConcepts.some(r => r.noteId === target.id)) {
      relatedConcepts.push({
        noteId: target.id,
        noteTitle: displayNoteTitle(ref.title),
        relationType: 'related-to',
        direction: 'outgoing',
      });
    }
  }

  return {
    centralTitle: displayNoteTitle(note.title),
    isConcept: isConceptNote(note),
    relatedConcepts,
    relationCounts,
    backlinkCount: referenceSummary?.incoming.length ?? 0,
    outgoingLinkCount: referenceSummary?.outgoing.length ?? 0,
    incomingRelationCount: relatedConcepts.filter(r => r.direction === 'incoming').length,
  };
}
