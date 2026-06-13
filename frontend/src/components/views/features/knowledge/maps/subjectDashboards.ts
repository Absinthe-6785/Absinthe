import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { getProperty, setProperty, removeProperty } from '../properties/noteProperties';
import { hasTag } from '../tags/noteTags';
import { isConceptNote } from '../research/noteClassification';
import type { SmartCollectionId } from '../collections/smartCollectionModels';
import {
  filterStudyProjectContainers,
  getLinkedStudyProjectId,
  isStudyProjectContainer,
} from '../academic/studyProjectModels';

export const LEARNING_PATH_PROPERTY = 'learningPath';
export const LEARNING_PATH_STEP_PROPERTY = 'learningPathStep';

export interface LearningPathStep {
  noteId: string;
  noteTitle: string;
  step: number;
}

export interface LearningPath {
  pathId: string;
  label: string;
  steps: LearningPathStep[];
}

export function getLearningPathId(note: NoteBase): string | null {
  const raw = getProperty(note, LEARNING_PATH_PROPERTY)?.trim();
  return raw || null;
}

export function getLearningPathStep(note: NoteBase): number | null {
  const raw = getProperty(note, LEARNING_PATH_STEP_PROPERTY)?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setLearningPathStep(
  note: NoteBase,
  pathId: string,
  step: number,
): NoteBase {
  let result = setProperty(note, LEARNING_PATH_PROPERTY, pathId.trim());
  result = setProperty(result, LEARNING_PATH_STEP_PROPERTY, String(step));
  return result;
}

export function clearLearningPath(note: NoteBase): NoteBase {
  let result = removeProperty(note, LEARNING_PATH_PROPERTY);
  result = removeProperty(result, LEARNING_PATH_STEP_PROPERTY);
  return result;
}

/** Collect manually ordered steps for a path slug — no recommendation engine. */
export function buildLearningPath(notes: readonly NoteBase[], pathId: string): LearningPath | null {
  const slug = pathId.trim();
  if (!slug) return null;
  const steps = notes
    .filter(n => !n.deletedAt && getLearningPathId(n) === slug)
    .map(n => ({
      noteId: n.id,
      noteTitle: displayNoteTitle(n.title),
      step: getLearningPathStep(n) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.step - b.step || a.noteTitle.localeCompare(b.noteTitle));
  if (steps.length === 0) return null;
  return { pathId: slug, label: slug.replace(/-/g, ' '), steps };
}

export function listLearningPathIds(notes: readonly NoteBase[]): string[] {
  const ids = new Set<string>();
  for (const note of notes) {
    if (note.deletedAt) continue;
    const id = getLearningPathId(note);
    if (id) ids.add(id);
  }
  return [...ids].sort();
}

export interface SubjectDashboardDefinition {
  id: string;
  name: string;
  tag: string;
  description: string;
}

/** Tag-based subject surfaces — no curriculum engine. */
export const SUBJECT_DASHBOARDS: readonly SubjectDashboardDefinition[] = [
  { id: 'japanese-history', name: 'Japanese History', tag: 'japanese-history', description: 'Meiji era, modern Japan, historical concepts' },
  { id: 'politics', name: 'Politics', tag: 'politics', description: 'Political systems, movements, governance' },
  { id: 'economics', name: 'Economics', tag: 'economics', description: 'Markets, policy, economic theory' },
  { id: 'toefl', name: 'TOEFL', tag: 'toefl', description: 'English proficiency study materials' },
  { id: 'vocabulary', name: 'Vocabulary', tag: 'vocabulary', description: 'Word lists and language vocabulary' },
];

/** Smart collection id per subject — first-class workspace surfaces. */
export const SUBJECT_WORKSPACE_COLLECTION_IDS: Record<string, SmartCollectionId> = {
  'japanese-history': 'subject-japanese-history',
  politics: 'subject-politics',
  economics: 'subject-economics',
  toefl: 'subject-toefl',
  vocabulary: 'subject-vocabulary',
};

export function getSubjectWorkspaceCollectionId(subjectId: string): SmartCollectionId | null {
  return SUBJECT_WORKSPACE_COLLECTION_IDS[subjectId] ?? null;
}

export function findSubjectByWorkspaceCollectionId(
  collectionId: SmartCollectionId,
): SubjectDashboardDefinition | undefined {
  return SUBJECT_DASHBOARDS.find(s => SUBJECT_WORKSPACE_COLLECTION_IDS[s.id] === collectionId);
}

export interface SubjectDashboardEntry {
  noteId: string;
  noteTitle: string;
  meta: string;
}

export interface SubjectDashboardData {
  subject: SubjectDashboardDefinition;
  conceptCount: number;
  noteCount: number;
  projectCount: number;
  linkedProjectCount: number;
  workspaceCollectionId: SmartCollectionId | null;
  recentNotes: SubjectDashboardEntry[];
  conceptNotes: SubjectDashboardEntry[];
  linkedProjects: SubjectDashboardEntry[];
}

export function buildSubjectDashboard(
  notes: readonly NoteBase[],
  subjectId: string,
  opts: { limit?: number } = {},
): SubjectDashboardData | null {
  const subject = SUBJECT_DASHBOARDS.find(s => s.id === subjectId);
  if (!subject) return null;
  const limit = opts.limit ?? 6;
  const tagged = notes.filter(n => !n.deletedAt && hasTag(n, subject.tag));
  const concepts = tagged.filter(isConceptNote);
  const projectContainers = filterStudyProjectContainers(notes).filter(
    p => hasTag(p, subject.tag),
  );
  const linkedProjects = filterStudyProjectContainers(notes).filter(project => {
    if (hasTag(project, subject.tag)) return false;
    return filterNotesLinkedToSubjectProject(notes, project.id, subject.tag).length > 0;
  });
  const allProjects = [...projectContainers, ...linkedProjects];
  const toEntry = (n: NoteBase): SubjectDashboardEntry => ({
    noteId: n.id,
    noteTitle: displayNoteTitle(n.title),
    meta: new Date(n.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
  });
  const recentNotes = [...tagged]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(toEntry);
  const conceptNotes = [...concepts]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(toEntry);
  const projectEntries = [...allProjects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(toEntry);
  return {
    subject,
    conceptCount: concepts.length,
    noteCount: tagged.length,
    projectCount: projectContainers.length,
    linkedProjectCount: allProjects.length,
    workspaceCollectionId: getSubjectWorkspaceCollectionId(subjectId),
    recentNotes,
    conceptNotes,
    linkedProjects: projectEntries,
  };
}

function filterNotesLinkedToSubjectProject(
  notes: readonly NoteBase[],
  projectId: string,
  subjectTag: string,
): NoteBase[] {
  return notes.filter(n => {
    if (n.deletedAt || isStudyProjectContainer(n)) return false;
    if (getLinkedStudyProjectId(n) !== projectId) return false;
    return hasTag(n, subjectTag);
  });
}
