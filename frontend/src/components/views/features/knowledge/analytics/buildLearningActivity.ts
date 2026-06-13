import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { getNoteKind } from '../research/noteClassification';
import { isStudyNote, REVIEW_NOTE_TAG } from '../study/studyNoteTemplate';
import { noteHasQuestionBlocks } from '../../../studyBlockUtils';
import { hasTag } from '../tags/noteTags';
import { isStudyProjectContainer } from '../academic/studyProjectModels';

export type LearningActivityKind = 'study' | 'research' | 'review' | 'project';

export interface LearningActivityEntry {
  noteId: string;
  noteTitle: string;
  kind: LearningActivityKind;
  timestamp: number;
  meta: string;
}

export interface LearningActivityData {
  items: LearningActivityEntry[];
}

export interface BuildLearningActivityOptions {
  limit?: number;
}

const RESEARCH_KINDS = new Set(['source', 'literature', 'permanent']);

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function isResearchNote(note: NoteBase): boolean {
  const kind = getNoteKind(note);
  return kind !== null && RESEARCH_KINDS.has(kind);
}

function isReviewActivity(note: NoteBase): boolean {
  return hasTag(note, REVIEW_NOTE_TAG) || noteHasQuestionBlocks(note.body ?? '');
}

function collectActivity(
  notes: readonly NoteBase[],
  kind: LearningActivityKind,
  filter: (n: NoteBase) => boolean,
): LearningActivityEntry[] {
  return notes
    .filter(n => !n.deletedAt && filter(n))
    .map(n => ({
      noteId: n.id,
      noteTitle: displayNoteTitle(n.title),
      kind,
      timestamp: n.updatedAt,
      meta: formatDate(n.updatedAt),
    }));
}

/** Recent learning activity from note timestamps — no planner integration. */
export function buildLearningActivity(
  notes: readonly NoteBase[],
  opts: BuildLearningActivityOptions = {},
): LearningActivityData {
  const limit = opts.limit ?? 12;
  const active = notes.filter(n => !n.deletedAt);

  const items = [
    ...collectActivity(active, 'study', isStudyNote),
    ...collectActivity(active, 'research', isResearchNote),
    ...collectActivity(active, 'review', isReviewActivity),
    ...collectActivity(active, 'project', isStudyProjectContainer),
  ];

  const deduped = new Map<string, LearningActivityEntry>();
  for (const item of items) {
    if (!deduped.has(item.noteId)) deduped.set(item.noteId, item);
  }

  return {
    items: [...deduped.values()]
      .sort((a, b) => b.timestamp - a.timestamp || a.noteId.localeCompare(b.noteId))
      .slice(0, limit),
  };
}
