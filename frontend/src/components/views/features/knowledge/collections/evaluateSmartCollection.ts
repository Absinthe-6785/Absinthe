import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterNotesByKind } from '../research/noteClassification';
import { isStudyNote, REVIEW_NOTE_TAG, EXAM_PREP_TAG } from '../study/studyNoteTemplate';
import { filterWeakTopicNotes } from '../study/weakTopicTracking';
import { noteHasQuestionBlocks } from '../../../studyBlockUtils';
import { hasTag } from '../tags/noteTags';
import {
  filterStudyProjectContainers,
} from '../academic/studyProjectModels';
import { filterProjectMilestones } from '../academic/projectMilestoneModels';
import { findSubjectByWorkspaceCollectionId } from '../maps/subjectDashboards';
import type { SmartCollectionId } from './smartCollectionModels';

/**
 * Compute note ids for a smart collection from indexes and note metadata.
 * Results are never persisted — always derived at read time.
 */
export function evaluateSmartCollection(
  collectionId: SmartCollectionId,
  service: KnowledgeIndexService,
  notes: readonly NoteBase[],
): string[] {
  switch (collectionId) {
    case 'recent':
      return [...notes]
        .filter(note => !note.deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(note => note.id);
    case 'orphan':
      return service.getOrphanNoteIds();
    case 'untagged':
      return service.getUntaggedNoteIds();
    case 'highly-connected':
      return service.getHighlyConnectedNoteIds();
    case 'with-backlinks':
      return service.getNoteIdsWithBacklinks();
    case 'with-mentions':
      return service.getNoteIdsWithMentions();
    case 'research-sources':
      return filterNotesByKind(notes, 'source')
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'research-literature':
      return filterNotesByKind(notes, 'literature')
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'research-permanent':
      return filterNotesByKind(notes, 'permanent')
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'exam-study-notes':
      return notes
        .filter(n => !n.deletedAt && isStudyNote(n))
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'exam-weak-topics':
      return filterWeakTopicNotes(notes)
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'exam-review-notes':
      return notes
        .filter(n => !n.deletedAt && (hasTag(n, REVIEW_NOTE_TAG) || noteHasQuestionBlocks(n.body ?? '')))
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'exam-prep':
      return notes
        .filter(n => !n.deletedAt && hasTag(n, EXAM_PREP_TAG))
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'map-concepts':
      return filterNotesByKind(notes, 'concept')
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'academic-study-projects':
      return filterStudyProjectContainers(notes)
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'academic-active-projects':
      return filterStudyProjectContainers(notes, 'active')
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'academic-completed-projects':
      return filterStudyProjectContainers(notes, 'completed')
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'academic-milestones':
      return filterProjectMilestones(notes)
        .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        .map(n => n.id);
    case 'subject-japanese-history':
    case 'subject-politics':
    case 'subject-economics':
    case 'subject-toefl':
    case 'subject-vocabulary':
      return evaluateSubjectWorkspaceCollection(collectionId, notes);
    default: {
      const _exhaustive: never = collectionId;
      return _exhaustive;
    }
  }
}

function evaluateSubjectWorkspaceCollection(
  collectionId: SmartCollectionId,
  notes: readonly NoteBase[],
): string[] {
  const subject = findSubjectByWorkspaceCollectionId(collectionId);
  if (!subject) return [];
  return notes
    .filter(n => !n.deletedAt && hasTag(n, subject.tag))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
    .map(n => n.id);
}
