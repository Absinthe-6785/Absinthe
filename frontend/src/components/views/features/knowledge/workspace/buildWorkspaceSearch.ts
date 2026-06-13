import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { NoteFolder } from '../../../../../store/useNotesStore';
import { SMART_COLLECTIONS } from '../collections/smartCollections';
import type { SmartCollectionId } from '../collections/smartCollectionModels';
import {
  filterStudyProjectContainers,
  isStudyProjectContainer,
} from '../academic/studyProjectModels';
import {
  filterProjectMilestones,
  isProjectMilestone,
} from '../academic/projectMilestoneModels';
import {
  listLearningPathIds,
  SUBJECT_DASHBOARDS,
  getSubjectWorkspaceCollectionId,
} from '../maps/subjectDashboards';
import { listTags, normalizeTagName } from '../tags/noteTags';

export type WorkspaceSearchResultKind =
  | 'note'
  | 'folder'
  | 'tag'
  | 'collection'
  | 'project'
  | 'milestone'
  | 'learning-path'
  | 'subject';

/** Lower score = higher rank. Kind priority: note → project → path → collection/tag → milestone → folder */
const KIND_PRIORITY: Record<WorkspaceSearchResultKind, number> = {
  note: 0,
  project: 1,
  'learning-path': 2,
  collection: 3,
  subject: 3,
  tag: 4,
  milestone: 5,
  folder: 6,
};

export interface WorkspaceSearchResult {
  id: string;
  kind: WorkspaceSearchResultKind;
  title: string;
  subtitle?: string;
  score: number;
  /** Payload for navigation handlers */
  collectionId?: SmartCollectionId;
  noteId?: string;
  folderId?: string;
  tag?: string;
  pathId?: string;
}

export interface WorkspaceSearchGroup {
  kind: WorkspaceSearchResultKind;
  results: WorkspaceSearchResult[];
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchScore(haystack: string, needle: string): number | null {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return null;
  if (h === n) return 0;
  if (h.startsWith(n)) return 1;
  if (h.includes(n)) return 2;
  return null;
}

function buildResult(
  kind: WorkspaceSearchResultKind,
  id: string,
  title: string,
  matchQuality: number,
  extras: Partial<WorkspaceSearchResult> = {},
): WorkspaceSearchResult {
  return {
    id,
    kind,
    title,
    score: KIND_PRIORITY[kind] * 10 + matchQuality,
    ...extras,
  };
}

function collectTags(notes: readonly NoteBase[]): Map<string, string> {
  const tags = new Map<string, string>();
  for (const note of notes) {
    if (note.deletedAt) continue;
    for (const tag of listTags(note)) {
      const key = normalizeTagName(tag);
      if (!tags.has(key)) tags.set(key, tag);
    }
  }
  return tags;
}

/** Global workspace search — grouped, ranked results for command palette. */
export function buildWorkspaceSearch(
  query: string,
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
): WorkspaceSearchGroup[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  const results: WorkspaceSearchResult[] = [];

  for (const note of notes) {
    if (note.deletedAt) continue;
    const title = displayNoteTitle(note.title);
    const m = matchScore(title, q);
    if (m !== null) {
      results.push(buildResult('note', note.id, title, m, { noteId: note.id }));
    }
  }

  for (const project of filterStudyProjectContainers(notes)) {
    const title = displayNoteTitle(project.title);
    const m = matchScore(title, q);
    if (m !== null) {
      results.push(buildResult('project', project.id, title, m, { noteId: project.id }));
    }
  }

  for (const pathId of listLearningPathIds(notes)) {
    const label = pathId.replace(/-/g, ' ');
    const m = matchScore(label, q) ?? matchScore(pathId, q);
    if (m !== null) {
      results.push(buildResult('learning-path', pathId, label, m, { pathId }));
    }
  }

  for (const collection of SMART_COLLECTIONS) {
    const m = matchScore(collection.name, q) ?? matchScore(collection.description, q);
    if (m !== null) {
      results.push(buildResult('collection', collection.id, collection.name, m, {
        collectionId: collection.id,
      }));
    }
  }

  for (const subject of SUBJECT_DASHBOARDS) {
    const m = matchScore(subject.name, q) ?? matchScore(subject.description, q);
    if (m !== null) {
      const collectionId = getSubjectWorkspaceCollectionId(subject.id);
      results.push(buildResult('subject', subject.id, subject.name, m, {
        collectionId: collectionId ?? undefined,
        subtitle: subject.description,
      }));
    }
  }

  for (const [key, display] of collectTags(notes)) {
    const m = matchScore(display, q) ?? matchScore(key, q);
    if (m !== null) {
      results.push(buildResult('tag', key, display, m, { tag: display }));
    }
  }

  for (const milestone of filterProjectMilestones(notes)) {
    const title = displayNoteTitle(milestone.title);
    const m = matchScore(title, q);
    if (m !== null) {
      results.push(buildResult('milestone', milestone.id, title, m, { noteId: milestone.id }));
    }
  }

  for (const folder of folders) {
    const m = matchScore(folder.name, q);
    if (m !== null) {
      results.push(buildResult('folder', folder.id, folder.name, m, { folderId: folder.id }));
    }
  }

  results.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));

  const byKind = new Map<WorkspaceSearchResultKind, WorkspaceSearchResult[]>();
  for (const r of results) {
    const list = byKind.get(r.kind) ?? [];
    list.push(r);
    byKind.set(r.kind, list);
  }

  const order: WorkspaceSearchResultKind[] = [
    'note', 'project', 'learning-path', 'collection', 'subject', 'tag', 'milestone', 'folder',
  ];

  return order
    .filter(kind => (byKind.get(kind)?.length ?? 0) > 0)
    .map(kind => ({ kind, results: byKind.get(kind)!.slice(0, 8) }));
}

/** Dedupe project hits when note is also a project container. */
export function isProjectNote(note: NoteBase): boolean {
  return isStudyProjectContainer(note);
}

export function isMilestoneNote(note: NoteBase): boolean {
  return isProjectMilestone(note);
}
