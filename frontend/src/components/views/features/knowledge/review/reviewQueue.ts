import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { buildBacklinkIndex, getBacklinkCount } from '../backlinks';
import { isMilestoneNote } from '../trace/milestoneNotes';
import { buildKnowledgeReviewLists } from './buildKnowledgeReview';
import { buildStaleNotesBuckets } from './staleNotes';

export type ReviewQueueReason =
  | 'stale'
  | 'linked'
  | 'recent'
  | 'milestone';

export interface ReviewQueueEntry {
  noteId: string;
  noteTitle: string;
  reason: ReviewQueueReason;
  meta: string;
}

export interface BuildReviewQueueOptions {
  limit?: number;
  activeOnly?: boolean;
  now?: number;
}

const REASON_LABELS: Record<ReviewQueueReason, string> = {
  stale: '오래됨',
  linked: '연결 허브',
  recent: '최근 편집',
  milestone: '마일스톤',
};

export function reviewQueueReasonLabel(reason: ReviewQueueReason): string {
  return REASON_LABELS[reason];
}

/** Manual review queue — curated candidates, no SRS. */
export function buildReviewQueue(
  notes: readonly NoteBase[],
  opts: BuildReviewQueueOptions = {},
): ReviewQueueEntry[] {
  const limit = opts.limit ?? 12;
  const activeOnly = opts.activeOnly !== false;
  const now = opts.now ?? Date.now();
  const active = notes.filter(n => !activeOnly || !n.deletedAt);

  const seen = new Set<string>();
  const queue: ReviewQueueEntry[] = [];

  const push = (noteId: string, noteTitle: string, reason: ReviewQueueReason, meta: string) => {
    if (seen.has(noteId) || queue.length >= limit) return;
    seen.add(noteId);
    queue.push({ noteId, noteTitle, reason, meta });
  };

  const stale = buildStaleNotesBuckets(active, { limitPerTier: 4, now });
  for (const entry of [...stale.days90, ...stale.days60]) {
    push(entry.noteId, entry.noteTitle, 'stale', entry.meta);
  }

  const index = buildBacklinkIndex(active);
  const hubs = [...active]
    .map(note => ({
      note,
      total: getBacklinkCount(index, note.title ?? '', note.id)
        + (index.outgoingByNoteId.get(note.id)?.length ?? 0),
    }))
    .filter(row => row.total >= 2)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
  for (const { note, total } of hubs) {
    push(note.id, displayNoteTitle(note.title), 'linked', `연결 ${total}개`);
  }

  const lists = buildKnowledgeReviewLists(active, { limit: 3 });
  for (const entry of lists.recentlyEdited.slice(0, 3)) {
    push(entry.noteId, entry.noteTitle, 'recent', entry.meta);
  }

  for (const note of active.filter(isMilestoneNote).slice(0, 3)) {
    push(note.id, displayNoteTitle(note.title), 'milestone', '마일스톤 노트');
  }

  return queue.slice(0, limit);
}
