import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { countQuestionsInMarkdown, noteHasQuestionBlocks } from '../../../studyBlockUtils';
import { hasTag } from '../tags/noteTags';
import { filterWeakTopicNotes, isWeakTopic } from './weakTopicTracking';
import { isStudyNote, REVIEW_NOTE_TAG, STUDY_NOTE_TAG } from './studyNoteTemplate';

export interface StudyNoteEntry {
  noteId: string;
  noteTitle: string;
  meta: string;
}

export interface StudyDashboardData {
  recentStudyNotes: StudyNoteEntry[];
  reviewCandidates: StudyNoteEntry[];
  weakTopics: StudyNoteEntry[];
  mostReviewed: StudyNoteEntry[];
  questionCount: number;
}

export interface BuildStudyDashboardOptions {
  limit?: number;
}

function toEntry(note: NoteBase, meta: string): StudyNoteEntry {
  return {
    noteId: note.id,
    noteTitle: displayNoteTitle(note.title),
    meta,
  };
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function isReviewCandidate(note: NoteBase): boolean {
  return hasTag(note, REVIEW_NOTE_TAG)
    || noteHasQuestionBlocks(note.body ?? '')
    || isWeakTopic(note);
}

export function buildStudyDashboard(
  notes: readonly NoteBase[],
  opts: BuildStudyDashboardOptions = {},
): StudyDashboardData {
  const limit = opts.limit ?? 6;
  const active = notes.filter(n => !n.deletedAt);

  const studyNotes = active
    .filter(isStudyNote)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const recentStudyNotes = studyNotes
    .slice(0, limit)
    .map(n => toEntry(n, `수정 ${formatDate(n.updatedAt)}`));

  const reviewCandidates = active
    .filter(isReviewCandidate)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(n => {
      const qCount = countQuestionsInMarkdown(n.body ?? '');
      const parts = [
        isWeakTopic(n) ? '약점' : null,
        qCount > 0 ? `질문 ${qCount}` : null,
        hasTag(n, REVIEW_NOTE_TAG) ? '#review' : null,
      ].filter(Boolean);
      return toEntry(n, parts.join(' · ') || '복습 후보');
    });

  const weakTopics = filterWeakTopicNotes(active)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(n => toEntry(n, `약점 · ${formatDate(n.updatedAt)}`));

  const mostReviewed = studyNotes
    .filter(n => noteHasQuestionBlocks(n.body ?? '') || hasTag(n, REVIEW_NOTE_TAG))
    .slice(0, limit)
    .map(n => toEntry(n, `복습 · ${formatDate(n.updatedAt)}`));

  const questionCount = active.reduce(
    (sum, n) => sum + countQuestionsInMarkdown(n.body ?? ''),
    0,
  );

  return {
    recentStudyNotes,
    reviewCandidates,
    weakTopics,
    mostReviewed,
    questionCount,
  };
}
